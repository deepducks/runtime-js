import { test, expect, describe } from "bun:test";
import { createHubFromFlags } from "../src/run";

describe("createHubFromFlags", () => {
  test("memory backend returns MemoryHub instance", async () => {
    const hub = await createHubFromFlags({ "event-backend": "memory" });
    expect(hub).toBeDefined();
    expect(typeof hub!.publish).toBe("function");
    await hub!.close();
  });

  test("absent event-backend defaults to memory (MemoryHub)", async () => {
    const hub = await createHubFromFlags({});
    expect(hub).toBeDefined();
    expect(typeof hub!.subscribe).toBe("function");
    await hub!.close();
  });

  test("undefined values defaults to memory (MemoryHub)", async () => {
    const hub = await createHubFromFlags(undefined);
    expect(hub).toBeDefined();
    expect(typeof hub!.close).toBe("function");
    await hub!.close();
  });

  test("nats backend without nats-url throws", async () => {
    await expect(createHubFromFlags({ "event-backend": "nats" })).rejects.toThrow("missing --nats-url");
  });

  test("unknown backend throws", async () => {
    await expect(createHubFromFlags({ "event-backend": "unknown" })).rejects.toThrow("unknown event backend: unknown");
  });
});
