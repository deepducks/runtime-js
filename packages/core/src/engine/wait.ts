import { evaluateCel } from "../cel/index";
import { parseDuration } from "./errors";
import type { WorkflowState } from "./state";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function executeWait(
  state: WorkflowState,
  waitDef: {
    event?: string;
    match?: string;
    until?: string;
    poll?: string;
    timeout?: string;
    onTimeout?: string;
  },
  chain?: unknown,
  hub?: { subscribe(event: string, signal?: AbortSignal): AsyncIterable<{ name: string; payload: unknown }> },
  signal?: AbortSignal,
): Promise<unknown> {
  const timeoutMs = waitDef.timeout ? parseDuration(waitDef.timeout) : undefined;
  const onTimeout = waitDef.onTimeout ?? "fail";

  // Sleep mode: only timeout, no event or until
  if (!waitDef.event && !waitDef.until && waitDef.timeout) {
    await sleep(parseDuration(waitDef.timeout));
    return chain;
  }

  // Polling mode: until + optional poll + optional timeout
  if (waitDef.until) {
    const pollMs = waitDef.poll ? parseDuration(waitDef.poll) : 1000;
    const deadline = timeoutMs ? Date.now() + timeoutMs : undefined;

    while (true) {
      if (signal?.aborted) {
        throw new Error("wait aborted");
      }

      const result = evaluateCel(waitDef.until, state.toCelContext());
      if (result === true) {
        return chain;
      }

      if (deadline && Date.now() >= deadline) {
        if (onTimeout === "skip") return chain;
        throw new Error(`wait polling timed out after ${waitDef.timeout}`);
      }

      await sleep(pollMs);
    }
  }

  // Event mode: event + optional match + optional timeout
  if (waitDef.event) {
    if (!hub) {
      throw new Error("wait.event requires an event hub but none was provided");
    }

    const controller = new AbortController();
    const combinedSignal = signal
      ? AbortSignal.any([signal, controller.signal])
      : controller.signal;

    let timeoutTimer: ReturnType<typeof setTimeout> | undefined;
    if (timeoutMs) {
      timeoutTimer = setTimeout(() => controller.abort(), timeoutMs);
    }

    try {
      for await (const envelope of hub.subscribe(waitDef.event, combinedSignal)) {
        if (waitDef.match) {
          // Evaluate match condition with event payload in context
          const prevEvent = state.eventPayload;
          state.eventPayload = envelope.payload;
          const matched = evaluateCel(waitDef.match, state.toCelContext());
          if (matched !== true) {
            // Restore previous event payload on non-match
            state.eventPayload = prevEvent;
            continue;
          }
        }

        // Event matched
        state.eventPayload = envelope.payload;
        return envelope.payload;
      }
    } catch (err) {
      if ((err as Error)?.name === "AbortError" || controller.signal.aborted) {
        if (onTimeout === "skip") return chain;
        throw new Error(`wait.event timed out after ${waitDef.timeout}`);
      }
      throw err;
    } finally {
      if (timeoutTimer) clearTimeout(timeoutTimer);
    }
  }

  return chain;
}
