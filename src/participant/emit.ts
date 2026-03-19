import { evaluateCel } from "../cel/index";
import type { EventHub } from "../eventhub/types";
import type { EmitParticipant, StepResult } from "../model/index";
import { parseDuration } from "../engine/errors";

export async function executeEmit(
  participant: EmitParticipant,
  context: Record<string, unknown>,
  hub: EventHub,
): Promise<StepResult> {
  const startedAt = new Date().toISOString();
  const start = Date.now();

  // Resolve payload
  let resolvedPayload: unknown;
  if (typeof participant.payload === "string") {
    resolvedPayload = evaluateCel(participant.payload, context);
  } else if (participant.payload && typeof participant.payload === "object") {
    const resolved: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(participant.payload)) {
      resolved[key] = typeof value === "string" ? evaluateCel(value, context) : value;
    }
    resolvedPayload = resolved;
  } else {
    resolvedPayload = {};
  }

  try {
    if (participant.ack) {
      const timeoutMs = participant.timeout ? parseDuration(participant.timeout) : 30000;
      await hub.publishAndWaitAck(participant.event, resolvedPayload, timeoutMs);
    } else {
      await hub.publish(participant.event, resolvedPayload);
    }

    return {
      status: "success",
      output: JSON.stringify({ ack: true }),
      parsedOutput: { ack: true },
      duration: Date.now() - start,
      startedAt,
      finishedAt: new Date().toISOString(),
    };
  } catch (err) {
    if (participant.onTimeout === "skip") {
      return {
        status: "success",
        output: JSON.stringify({ ack: false }),
        parsedOutput: { ack: false },
        duration: Date.now() - start,
        startedAt,
        finishedAt: new Date().toISOString(),
      };
    }
    throw err;
  }
}
