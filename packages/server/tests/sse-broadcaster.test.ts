import { describe, it, expect } from "bun:test";
import { SSEBroadcaster } from "../src/api/services/sse-broadcaster.ts";

describe("SSEBroadcaster", () => {
  it("starts with zero clients", () => {
    const b = new SSEBroadcaster();
    expect(b.clientCount).toBe(0);
  });

  it("delivers broadcast to all subscribers", () => {
    const b = new SSEBroadcaster();
    const received: string[][] = [[], []];

    b.subscribe((data) => received[0].push(data));
    b.subscribe((data) => received[1].push(data));

    b.broadcast({ type: "trace:new", executionId: "abc" });

    expect(received[0]).toHaveLength(1);
    expect(received[1]).toHaveLength(1);
    expect(JSON.parse(received[0][0])).toEqual({ type: "trace:new", executionId: "abc" });
  });

  it("unsubscribe removes the client", () => {
    const b = new SSEBroadcaster();
    const received: string[] = [];

    const unsub = b.subscribe((data) => received.push(data));
    b.broadcast({ type: "trace:new", executionId: "1" });
    unsub();
    b.broadcast({ type: "trace:new", executionId: "2" });

    expect(received).toHaveLength(1);
    expect(b.clientCount).toBe(0);
  });

  it("broadcasts to remaining clients after one unsubscribes", () => {
    const b = new SSEBroadcaster();
    const a: string[] = [];
    const c: string[] = [];

    const unsubA = b.subscribe((d) => a.push(d));
    b.subscribe((d) => c.push(d));
    unsubA();

    b.broadcast({ type: "execution:finished", executionId: "x", status: "success" });

    expect(a).toHaveLength(0);
    expect(c).toHaveLength(1);
  });

  it("handles empty broadcast (no clients) without error", () => {
    const b = new SSEBroadcaster();
    expect(() => b.broadcast({ type: "trace:updated", executionId: "x" })).not.toThrow();
  });
});
