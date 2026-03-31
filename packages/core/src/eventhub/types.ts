export interface EventEnvelope {
  name: string;
  payload: unknown;
}

export interface EventHubConfig {
  backend: "memory" | "nats" | "redis";
  nats?: { url: string; stream?: string };
  redis?: { addr?: string; db?: number; consumerGroup?: string };
}

export interface EventHub {
  publish(event: string, payload: unknown): Promise<void>;
  publishAndWaitAck(event: string, payload: unknown, timeoutMs: number): Promise<void>;
  subscribe(event: string, signal?: AbortSignal): AsyncIterable<EventEnvelope>;
  close(): Promise<void>;
}
