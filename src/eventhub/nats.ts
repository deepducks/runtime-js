import type { EventEnvelope, EventHub, EventHubConfig } from "./types";

/**
 * NATS JetStream event hub — mirrors Go runner's NATSHub behavior.
 *
 * Each NatsHub instance owns one NATS connection. Subscribing creates an
 * ephemeral ordered consumer, so two NatsHub instances subscribing to the
 * same topic each receive every message (fan-out).
 *
 * Stream names replace dots with underscores (JetStream restriction).
 */
export class NatsHub implements EventHub {
  // Using `any` because nats is an optional dynamic import
  private nc: any;
  private js: any;
  private jsm: any;
  private ensuredStreams = new Set<string>();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private constructor(private config: NonNullable<EventHubConfig["nats"]>) {} // config used by create()

  static async create(config: NonNullable<EventHubConfig["nats"]>): Promise<NatsHub> {
    const hub = new NatsHub(config);
    const nats = await import("nats");
    hub.nc = await nats.connect({ servers: config.url });
    hub.js = hub.nc.jetstream();
    hub.jsm = await hub.nc.jetstreamManager();
    return hub;
  }

  /** JetStream stream names cannot contain dots. */
  private streamName(topic: string): string {
    return topic.replace(/\./g, "_");
  }

  /** Create-or-update the JetStream stream for a topic. */
  private async ensureStream(topic: string): Promise<void> {
    const name = this.streamName(topic);
    if (this.ensuredStreams.has(name)) return;

    try {
      await this.jsm.streams.add({ name, subjects: [topic] });
    } catch (err: any) {
      // If stream already exists with same config, that's fine
      const msg = String(err?.message ?? err);
      if (!msg.includes("already in use") && !msg.includes("already exist")) {
        throw err;
      }
    }
    this.ensuredStreams.add(name);
  }

  async publish(event: string, payload: unknown): Promise<void> {
    await this.ensureStream(event);
    const envelope: EventEnvelope = { name: event, payload };
    const data = new TextEncoder().encode(JSON.stringify(envelope));
    await this.js.publish(event, data);
  }

  async publishAndWaitAck(event: string, payload: unknown, _timeoutMs: number): Promise<void> {
    // JetStream publish returns a PubAck — server confirmed persistence
    await this.publish(event, payload);
  }

  async *subscribe(event: string, signal?: AbortSignal): AsyncIterable<EventEnvelope> {
    await this.ensureStream(event);

    // Ordered consumer = ephemeral, auto-created, receives all messages from
    // the latest offset. Each call creates an independent consumer (fan-out).
    const consumer = await this.js.consumers.get(this.streamName(event));
    const iter = await consumer.consume();

    const onAbort = () => iter.stop();
    signal?.addEventListener("abort", onAbort);

    try {
      for await (const msg of iter) {
        if (signal?.aborted) break;
        try {
          const envelope = JSON.parse(new TextDecoder().decode(msg.data)) as EventEnvelope;
          msg.ack();
          yield envelope;
        } catch {
          msg.ack(); // ack malformed to avoid redelivery loop
        }
      }
    } finally {
      signal?.removeEventListener("abort", onAbort);
    }
  }

  async close(): Promise<void> {
    await this.nc.drain();
  }
}
