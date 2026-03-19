import type { EventEnvelope, EventHub, EventHubConfig } from "./types";

/**
 * Redis Streams event hub — mirrors Go runner's RedisHub behavior.
 *
 * Uses XADD/XREADGROUP with consumer groups. Each RedisHub instance owns one
 * connection and one consumer group. For fan-out, create multiple hubs with
 * different consumerGroup names (matching Go runner pattern).
 *
 * Consumer groups read from "0" (beginning of stream) so late subscribers
 * receive messages published before they subscribed (persistent replay).
 */
export class RedisHub implements EventHub {
  private client: any;
  private consumerGroup: string;
  private consumerId: string;

  private constructor(config: NonNullable<EventHubConfig["redis"]>) {
    this.consumerGroup = config.consumerGroup ?? "duckflux";
    this.consumerId = `consumer-${crypto.randomUUID().slice(0, 8)}`;
  }

  static async create(config: NonNullable<EventHubConfig["redis"]>): Promise<RedisHub> {
    const hub = new RedisHub(config);
    const Redis = (await import("ioredis")).default;

    // Parse "host:port" format (Go runner convention)
    const addr = config.addr ?? "localhost:6379";
    const [host, portStr] = addr.split(":");
    const port = parseInt(portStr ?? "6379", 10);

    hub.client = new Redis({ host, port, db: config.db ?? 0, lazyConnect: false });
    return hub;
  }

  async publish(event: string, payload: unknown): Promise<void> {
    const envelope: EventEnvelope = { name: event, payload };
    await this.client.xadd(event, "*", "data", JSON.stringify(envelope));
  }

  async publishAndWaitAck(event: string, payload: unknown, _timeoutMs: number): Promise<void> {
    // Redis XADD is synchronous on the server — success means persisted
    await this.publish(event, payload);
  }

  async *subscribe(event: string, signal?: AbortSignal): AsyncIterable<EventEnvelope> {
    // Create consumer group from "0" (read all history) with MKSTREAM
    try {
      await this.client.xgroup("CREATE", event, this.consumerGroup, "0", "MKSTREAM");
    } catch (err: any) {
      const msg = String(err?.message ?? err);
      if (!msg.includes("BUSYGROUP")) throw err;
      // BUSYGROUP = group already exists, that's fine
    }

    while (!signal?.aborted) {
      try {
        const result = await this.client.xreadgroup(
          "GROUP", this.consumerGroup, this.consumerId,
          "COUNT", 10,
          "BLOCK", 1000,
          "STREAMS", event, ">",
        );

        if (!result) continue;

        // ioredis returns: [[streamName, [[id, [field, value, ...]], ...]]]
        for (const [, messages] of result) {
          for (const [msgId, fields] of messages) {
            // fields is [key, value, key, value, ...]
            const dataIdx = fields.indexOf("data");
            if (dataIdx === -1 || dataIdx + 1 >= fields.length) continue;
            try {
              const envelope = JSON.parse(fields[dataIdx + 1]) as EventEnvelope;
              // ACK the message
              await this.client.xack(event, this.consumerGroup, msgId);
              yield envelope;
            } catch {
              // ACK malformed to avoid redelivery
              await this.client.xack(event, this.consumerGroup, msgId);
            }
            if (signal?.aborted) return;
          }
        }
      } catch (err) {
        if (signal?.aborted) return;
        throw err;
      }
    }
  }

  async close(): Promise<void> {
    await this.client.quit();
  }
}
