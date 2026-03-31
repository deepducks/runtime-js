import type { EventEnvelope, EventHub } from "./types";

type Listener = (envelope: EventEnvelope) => void;

export class MemoryHub implements EventHub {
  private listeners = new Map<string, Set<Listener>>();
  private buffer = new Map<string, EventEnvelope[]>();
  private closed = false;

  async publish(event: string, payload: unknown): Promise<void> {
    if (this.closed) throw new Error("hub is closed");

    const envelope: EventEnvelope = { name: event, payload };

    // Buffer for replay
    let buf = this.buffer.get(event);
    if (!buf) {
      buf = [];
      this.buffer.set(event, buf);
    }
    buf.push(envelope);

    // Fan-out to current listeners
    const listeners = this.listeners.get(event);
    if (listeners) {
      for (const listener of listeners) {
        listener(envelope);
      }
    }
  }

  async publishAndWaitAck(event: string, payload: unknown, _timeoutMs: number): Promise<void> {
    // In-memory delivery is synchronous, so ack is immediate
    await this.publish(event, payload);
  }

  async *subscribe(event: string, signal?: AbortSignal): AsyncIterable<EventEnvelope> {
    if (this.closed) return;

    // Replay buffered events first
    const buffered = this.buffer.get(event);
    if (buffered) {
      for (const envelope of buffered) {
        if (signal?.aborted) return;
        yield envelope;
      }
    }

    // Then listen for new events
    const queue: EventEnvelope[] = [];
    let resolve: (() => void) | null = null;

    const listener: Listener = (envelope) => {
      queue.push(envelope);
      if (resolve) {
        resolve();
        resolve = null;
      }
    };

    let listeners = this.listeners.get(event);
    if (!listeners) {
      listeners = new Set();
      this.listeners.set(event, listeners);
    }
    listeners.add(listener);

    const onAbort = () => {
      listeners!.delete(listener);
      if (resolve) {
        resolve();
        resolve = null;
      }
    };

    if (signal) {
      signal.addEventListener("abort", onAbort);
    }

    try {
      while (!this.closed && !signal?.aborted) {
        if (queue.length > 0) {
          yield queue.shift()!;
        } else {
          await new Promise<void>((r) => {
            resolve = r;
          });
        }
      }
    } finally {
      listeners.delete(listener);
      if (signal) {
        signal.removeEventListener("abort", onAbort);
      }
    }
  }

  async close(): Promise<void> {
    this.closed = true;
    // Wake up all waiting subscribers
    for (const listeners of this.listeners.values()) {
      listeners.clear();
    }
    this.listeners.clear();
  }
}
