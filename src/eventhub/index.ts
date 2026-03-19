export type { EventHub, EventEnvelope, EventHubConfig } from "./types";
export { MemoryHub } from "./memory";
export { NatsHub } from "./nats";
export { RedisHub } from "./redis";

import type { EventHub, EventHubConfig } from "./types";
import { MemoryHub } from "./memory";

export async function createHub(config: EventHubConfig): Promise<EventHub> {
  switch (config.backend) {
    case "memory":
      return new MemoryHub();
    case "nats": {
      if (!config.nats?.url) {
        throw new Error("NATS backend requires 'nats.url' configuration");
      }
      const { NatsHub } = await import("./nats");
      return NatsHub.create(config.nats);
    }
    case "redis": {
      const { RedisHub } = await import("./redis");
      return RedisHub.create(config.redis ?? {});
    }
    default:
      throw new Error(`unknown event hub backend: ${(config as { backend: string }).backend}`);
  }
}
