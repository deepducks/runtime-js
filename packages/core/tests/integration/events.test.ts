import { test, expect } from "bun:test";
import { MemoryHub } from "../../src/eventhub/memory";

// ─────────────────────────────────────────────────────────
// MemoryHub tests
// ─────────────────────────────────────────────────────────

test("MemoryHub: publish/subscribe round-trip", async () => {
  // Go: TestGoChannelPublishSubscribeRoundTrip
  const hub = new MemoryHub();
  const controller = new AbortController();
  const received: { name: string; payload: unknown }[] = [];

  const subscriberDone = (async () => {
    for await (const envelope of hub.subscribe("test.event", controller.signal)) {
      received.push(envelope);
      controller.abort();
      break;
    }
  })();

  await new Promise((r) => setTimeout(r, 10));

  await hub.publish("test.event", { hello: "world" });
  await subscriberDone.catch(() => {});

  expect(received.length).toBe(1);
  expect(received[0].name).toBe("test.event");
  expect((received[0].payload as { hello: string }).hello).toBe("world");

  await hub.close();
});

test("MemoryHub: persistent replay (publish before subscribe)", async () => {
  // Go: TestGoChannelPersistentReplay
  const hub = new MemoryHub();

  // Publish BEFORE subscribing
  await hub.publish("pre.event", "before-sub");

  // Subscribe after publish — should still receive the event
  const controller = new AbortController();
  const received: { name: string; payload: unknown }[] = [];

  const sub = (async () => {
    for await (const envelope of hub.subscribe("pre.event", controller.signal)) {
      received.push(envelope);
      controller.abort();
      break;
    }
  })();

  await sub.catch(() => {});

  expect(received.length).toBe(1);
  expect(received[0].name).toBe("pre.event");

  await hub.close();
});

test("MemoryHub: publishAndWaitAck with subscriber", async () => {
  // Go: TestGoChannelPublishAndWaitAck
  const hub = new MemoryHub();

  // Subscribe so publish has somewhere to deliver
  const controller = new AbortController();
  const consumer = (async () => {
    for await (const _ of hub.subscribe("ack.event", controller.signal)) {
      // just consume
    }
  })();

  // publishAndWaitAck should resolve immediately for in-memory
  await hub.publishAndWaitAck("ack.event", "payload", 2000);

  controller.abort();
  await consumer.catch(() => {});
  await hub.close();
});

test("MemoryHub: ack timeout (no subscriber)", async () => {
  // Go: TestGoChannelAckTimeout
  // GoChannel with Persistent=true still delivers to future subscribers,
  // so publish returns immediately. JS MemoryHub mirrors this behavior.
  const hub = new MemoryHub();
  await expect(hub.publishAndWaitAck("timeout.event", null, 100)).resolves.toBeUndefined();
  await hub.close();
});

test("MemoryHub: multiple subscribers (fan-out)", async () => {
  // Go: TestGoChannelMultipleSubscribers
  const hub = new MemoryHub();

  const ctrl1 = new AbortController();
  const ctrl2 = new AbortController();
  const received1: { name: string; payload: unknown }[] = [];
  const received2: { name: string; payload: unknown }[] = [];

  const s1 = (async () => {
    for await (const e of hub.subscribe("multi.event", ctrl1.signal)) {
      received1.push(e);
      ctrl1.abort();
      break;
    }
  })();

  const s2 = (async () => {
    for await (const e of hub.subscribe("multi.event", ctrl2.signal)) {
      received2.push(e);
      ctrl2.abort();
      break;
    }
  })();

  await new Promise((r) => setTimeout(r, 10));
  await hub.publish("multi.event", 42);

  await Promise.all([s1.catch(() => {}), s2.catch(() => {})]);

  expect(received1.length).toBe(1);
  expect(received1[0].name).toBe("multi.event");
  expect(received2.length).toBe(1);
  expect(received2[0].name).toBe("multi.event");

  await hub.close();
});

// ─────────────────────────────────────────────────────────
// createHub factory test
// ─────────────────────────────────────────────────────────

test("createHub: memory backend", async () => {
  const { createHub } = await import("../../src/eventhub/index");
  const hub = await createHub({ backend: "memory" });
  expect(hub).toBeDefined();
  await hub.close();
});

test("createHub: unknown backend throws", async () => {
  const { createHub } = await import("../../src/eventhub/index");
  await expect(createHub({ backend: "unknown" as any })).rejects.toThrow(/unknown event hub backend/);
});

// ─────────────────────────────────────────────────────────
// Integration: emit → wait.event pipeline (using MemoryHub)
// ─────────────────────────────────────────────────────────

test("integration: emit → wait.event pipeline with MemoryHub", async () => {
  const hub = new MemoryHub();

  // Simulate the emit side: publish an event after a short delay
  setTimeout(async () => {
    await hub.publish("order.created", { orderId: "abc-123", amount: 99 });
  }, 50);

  // Simulate the wait side: subscribe and wait for the event
  const controller = new AbortController();
  let receivedPayload: unknown = null;

  const waiter = (async () => {
    for await (const envelope of hub.subscribe("order.created", controller.signal)) {
      receivedPayload = envelope.payload;
      controller.abort();
      break;
    }
  })();

  await waiter.catch(() => {});

  expect(receivedPayload).toBeDefined();
  expect((receivedPayload as { orderId: string }).orderId).toBe("abc-123");
  expect((receivedPayload as { amount: number }).amount).toBe(99);

  await hub.close();
});

test("integration: emit → wait.event with match condition", async () => {
  const hub = new MemoryHub();

  // Publish multiple events, only one should match
  setTimeout(async () => {
    await hub.publish("payment.done", { amount: 10 }); // won't match
    await hub.publish("payment.done", { amount: 200 }); // should match
  }, 50);

  const controller = new AbortController();
  const matched: unknown[] = [];

  const waiter = (async () => {
    for await (const envelope of hub.subscribe("payment.done", controller.signal)) {
      const payload = envelope.payload as { amount: number };
      // Simulating match condition: amount > 100
      if (payload.amount > 100) {
        matched.push(payload);
        controller.abort();
        break;
      }
    }
  })();

  await waiter.catch(() => {});

  expect(matched.length).toBe(1);
  expect((matched[0] as { amount: number }).amount).toBe(200);

  await hub.close();
});
