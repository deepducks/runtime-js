import { test, expect, beforeAll, afterAll } from "bun:test";
import { startContainer, stopContainer, type DockerContainer } from "./docker-helpers";
import { RedisHub } from "@duckflux/hub-redis";

// ─────────────────────────────────────────────────────────
// Redis Streams integration tests
// Requires Docker. Skips if Docker is not available.
// ─────────────────────────────────────────────────────────

let container: DockerContainer | null = null;
let redisAddr: string;

beforeAll(async () => {
  container = await startContainer("redis:7", 6379);
  if (container) {
    redisAddr = `${container.host}:${container.port}`;
  }
}, 30_000);

afterAll(async () => {
  if (container) await stopContainer(container);
}, 10_000);

function skipIfNoDocker() {
  if (!container) {
    console.warn("Skipping: Docker not available");
    return true;
  }
  return false;
}

// Go: TestRedisPublishSubscribeRoundTrip
test("RedisHub: publish/subscribe round-trip", async () => {
  if (skipIfNoDocker()) return;

  const hub = await RedisHub.create({ addr: redisAddr, consumerGroup: "test-roundtrip" });
  const controller = new AbortController();
  const received: { name: string; payload: unknown }[] = [];

  const subscriberDone = (async () => {
    for await (const envelope of hub.subscribe("redis.roundtrip", controller.signal)) {
      received.push(envelope);
      controller.abort();
      break;
    }
  })();

  await new Promise((r) => setTimeout(r, 200));

  await hub.publish("redis.roundtrip", { hello: "redis" });

  await subscriberDone.catch(() => {});

  expect(received.length).toBe(1);
  expect(received[0].name).toBe("redis.roundtrip");
  expect((received[0].payload as { hello: string }).hello).toBe("redis");

  await hub.close();
}, 30_000);

// Go: TestRedisPersistentReplay
test("RedisHub: persistent replay (publish before subscribe)", async () => {
  if (skipIfNoDocker()) return;

  const hub = await RedisHub.create({ addr: redisAddr, consumerGroup: "test-replay" });

  // Publish BEFORE subscribing
  await hub.publish("redis.pre", "before-sub");

  const controller = new AbortController();
  const received: { name: string; payload: unknown }[] = [];

  const sub = (async () => {
    for await (const envelope of hub.subscribe("redis.pre", controller.signal)) {
      received.push(envelope);
      controller.abort();
      break;
    }
  })();

  await sub.catch(() => {});

  expect(received.length).toBe(1);
  expect(received[0].name).toBe("redis.pre");

  await hub.close();
}, 30_000);

// Go: TestRedisPublishAndWaitAck
test("RedisHub: publishAndWaitAck", async () => {
  if (skipIfNoDocker()) return;

  const hub = await RedisHub.create({ addr: redisAddr, consumerGroup: "test-ack" });
  const controller = new AbortController();

  const consumer = (async () => {
    for await (const _ of hub.subscribe("redis.ack", controller.signal)) {
      // just consume
    }
  })();

  await new Promise((r) => setTimeout(r, 200));

  await hub.publishAndWaitAck("redis.ack", "payload", 10_000);

  controller.abort();
  await consumer.catch(() => {});
  await hub.close();
}, 30_000);

// Go: TestRedisMultipleSubscribers
test("RedisHub: multiple subscribers (fan-out via separate consumer groups)", async () => {
  if (skipIfNoDocker()) return;

  const hub1 = await RedisHub.create({ addr: redisAddr, consumerGroup: "test-multi-g1" });
  const hub2 = await RedisHub.create({ addr: redisAddr, consumerGroup: "test-multi-g2" });

  const ctrl1 = new AbortController();
  const ctrl2 = new AbortController();
  const received1: { name: string; payload: unknown }[] = [];
  const received2: { name: string; payload: unknown }[] = [];

  const s1 = (async () => {
    for await (const e of hub1.subscribe("redis.multi", ctrl1.signal)) {
      received1.push(e);
      ctrl1.abort();
      break;
    }
  })();

  const s2 = (async () => {
    for await (const e of hub2.subscribe("redis.multi", ctrl2.signal)) {
      received2.push(e);
      ctrl2.abort();
      break;
    }
  })();

  await new Promise((r) => setTimeout(r, 200));
  await hub1.publish("redis.multi", 42);

  await Promise.all([s1.catch(() => {}), s2.catch(() => {})]);

  expect(received1.length).toBe(1);
  expect(received1[0].name).toBe("redis.multi");
  expect(received2.length).toBe(1);
  expect(received2[0].name).toBe("redis.multi");

  await hub1.close();
  await hub2.close();
}, 30_000);
