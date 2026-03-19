import { test, expect, beforeAll, afterAll } from "bun:test";
import { startContainer, stopContainer, type DockerContainer } from "./docker-helpers";
import { NatsHub } from "../../src/eventhub/nats";

// ─────────────────────────────────────────────────────────
// NATS JetStream integration tests — aligned with Go runner nats_test.go
// Requires Docker. Skips if Docker is not available.
// ─────────────────────────────────────────────────────────

let container: DockerContainer | null = null;
let natsUrl: string;

beforeAll(async () => {
  container = await startContainer("nats:2.10", 4222, ["--js"]);
  if (container) {
    natsUrl = `nats://${container.host}:${container.port}`;
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

// Go: TestNATSPublishSubscribeRoundTrip
test("NatsHub: publish/subscribe round-trip", async () => {
  if (skipIfNoDocker()) return;

  const hub = await NatsHub.create({ url: natsUrl });
  const controller = new AbortController();
  const received: { name: string; payload: unknown }[] = [];

  const subscriberDone = (async () => {
    for await (const envelope of hub.subscribe("nats.roundtrip", controller.signal)) {
      received.push(envelope);
      controller.abort();
      break;
    }
  })();

  await new Promise((r) => setTimeout(r, 500));

  await hub.publish("nats.roundtrip", { hello: "nats" });
  await subscriberDone.catch(() => {});

  expect(received.length).toBe(1);
  expect(received[0].name).toBe("nats.roundtrip");
  expect((received[0].payload as { hello: string }).hello).toBe("nats");

  await hub.close();
}, 30_000);

// Go: TestNATSPersistentReplay — skipped (NATS ephemeral consumers don't replay)
test("NatsHub: persistent replay (skipped — ephemeral consumers don't replay)", () => {
  // Go: t.Skip("NATS JetStream ephemeral consumers do not replay pre-subscribe messages")
  console.warn("Skipped: NATS ephemeral consumers do not replay pre-subscribe messages");
});

// Go: TestNATSPublishAndWaitAck
test("NatsHub: publishAndWaitAck", async () => {
  if (skipIfNoDocker()) return;

  const hub = await NatsHub.create({ url: natsUrl });
  const controller = new AbortController();

  const consumer = (async () => {
    for await (const _ of hub.subscribe("nats.ack", controller.signal)) {
      // just consume
    }
  })();

  await new Promise((r) => setTimeout(r, 500));

  await hub.publishAndWaitAck("nats.ack", "payload", 10_000);

  controller.abort();
  await consumer.catch(() => {});
  await hub.close();
}, 30_000);

// Go: TestNATSMultipleSubscribers
test("NatsHub: multiple subscribers (fan-out via separate hubs)", async () => {
  if (skipIfNoDocker()) return;

  const hub1 = await NatsHub.create({ url: natsUrl });
  const hub2 = await NatsHub.create({ url: natsUrl });

  const ctrl1 = new AbortController();
  const ctrl2 = new AbortController();
  const received1: { name: string; payload: unknown }[] = [];
  const received2: { name: string; payload: unknown }[] = [];

  const s1 = (async () => {
    for await (const e of hub1.subscribe("nats.multi", ctrl1.signal)) {
      received1.push(e);
      ctrl1.abort();
      break;
    }
  })();

  const s2 = (async () => {
    for await (const e of hub2.subscribe("nats.multi", ctrl2.signal)) {
      received2.push(e);
      ctrl2.abort();
      break;
    }
  })();

  await new Promise((r) => setTimeout(r, 500));
  await hub1.publish("nats.multi", 42);

  await Promise.all([s1.catch(() => {}), s2.catch(() => {})]);

  expect(received1.length).toBe(1);
  expect(received1[0].name).toBe("nats.multi");
  expect(received2.length).toBe(1);
  expect(received2[0].name).toBe("nats.multi");

  await hub1.close();
  await hub2.close();
}, 30_000);

// Go: ensureStream — dot-notation stream names
test("NatsHub: dot-notation topics work (stream name sanitized)", async () => {
  if (skipIfNoDocker()) return;

  const hub = await NatsHub.create({ url: natsUrl });
  const controller = new AbortController();
  const received: { name: string; payload: unknown }[] = [];

  const sub = (async () => {
    for await (const e of hub.subscribe("order.payment.done", controller.signal)) {
      received.push(e);
      controller.abort();
      break;
    }
  })();

  await new Promise((r) => setTimeout(r, 500));
  await hub.publish("order.payment.done", { status: "ok" });

  await sub.catch(() => {});

  expect(received.length).toBe(1);
  expect(received[0].name).toBe("order.payment.done");

  await hub.close();
}, 30_000);
