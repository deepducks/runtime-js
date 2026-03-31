export type { EventHub, EventEnvelope, EventHubConfig } from "./types";
export { MemoryHub } from "./memory";

import type { EventHub, EventHubConfig } from "./types";
import { MemoryHub } from "./memory";

export async function createHub(config: EventHubConfig): Promise<EventHub> {
  switch (config.backend) {
    case "memory":
      return new MemoryHub();
    case "nats":
      throw new Error(
        "NATS backend has been moved to @duckflux/hub-nats. " +
        "Install it and pass a NatsHub instance via ExecuteOptions.hub instead.",
      );
    case "redis":
      throw new Error(
        "Redis backend has been moved to @duckflux/hub-redis. " +
        "Install it and pass a RedisHub instance via ExecuteOptions.hub instead.",
      );
    default:
      throw new Error(`unknown event hub backend: ${(config as { backend: string }).backend}`);
  }
}
