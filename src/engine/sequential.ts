import { evaluateCel } from "../cel/index";
import type {
  ErrorStrategy,
  Participant,
  StepResult,
  Workflow,
} from "../model/index";
import { executeParticipant } from "../participant/index";
import type { WorkflowEngineExecutor } from "../participant/workflow";
import { executeWithRetry, resolveErrorStrategy } from "./errors";
import type { WorkflowState } from "./state";
import { resolveTimeout, withTimeout } from "./timeout";

function isControlFlowStep(step: unknown): boolean {
  if (typeof step !== "object" || step == null || Array.isArray(step)) {
    return false;
  }

  const keys = Object.keys(step as Record<string, unknown>);
  return keys.length === 1 && ["loop", "parallel", "if", "wait"].includes(keys[0]);
}

function isInlineParticipant(step: unknown): boolean {
  if (typeof step !== "object" || step == null || Array.isArray(step)) {
    return false;
  }
  return "type" in (step as Record<string, unknown>);
}

function resolveParticipantInput(
  participantInput: string | Record<string, string> | undefined,
  state: WorkflowState,
): unknown {
  if (participantInput === undefined) {
    return undefined;
  }

  if (typeof participantInput === "string") {
    return evaluateCel(participantInput, state.toCelContext());
  }

  const resolved: Record<string, unknown> = {};
  for (const [key, expr] of Object.entries(participantInput)) {
    resolved[key] = evaluateCel(expr, state.toCelContext());
  }
  return resolved;
}

export function mergeChainedInput(chain: unknown, explicit: unknown): unknown {
  if (explicit === undefined || explicit === null) return chain;
  if (chain === undefined || chain === null) return explicit;

  const chainIsMap = typeof chain === "object" && !Array.isArray(chain);
  const explicitIsMap = typeof explicit === "object" && !Array.isArray(explicit);

  if (chainIsMap && explicitIsMap) {
    return { ...(chain as Record<string, unknown>), ...(explicit as Record<string, unknown>) };
  }

  if (typeof chain === "string" && typeof explicit === "string") {
    return explicit;
  }

  // Incompatible types: explicit wins
  return explicit;
}

type FlowOverride = {
  timeout?: string;
  onError?: ErrorStrategy;
  when?: string;
  input?: string | Record<string, string>;
  retry?: {
    max: number;
    backoff?: string;
    factor?: number;
  };
};

export async function executeStep(
  workflow: Workflow,
  state: WorkflowState,
  step: unknown,
  basePath = process.cwd(),
  engineExecutor?: WorkflowEngineExecutor,
  fallbackStack: string[] = [],
  chain?: unknown,
): Promise<unknown> {
  if (isControlFlowStep(step)) {
    throw new Error("control-flow construct passed to executeStep");
  }

  let stepName: string | undefined;
  let participant: Participant;
  let override: FlowOverride | undefined;

  if (typeof step === "string") {
    // Named participant reference
    stepName = step;
    const p = workflow.participants?.[stepName];
    if (!p) {
      throw new Error(`participant '${stepName}' not found`);
    }
    participant = p;
  } else if (isInlineParticipant(step)) {
    // Inline participant
    const inline = step as Participant & { as?: string; when?: string };
    stepName = inline.as;
    participant = inline;
  } else if (typeof step === "object" && step != null && !Array.isArray(step)) {
    // Participant override
    const keys = Object.keys(step);
    if (keys.length !== 1) {
      throw new Error("invalid flow step override");
    }
    stepName = keys[0];
    override = (step as Record<string, FlowOverride>)[stepName];
    const p = workflow.participants?.[stepName];
    if (!p) {
      throw new Error(`participant '${stepName}' not found`);
    }
    participant = p;
  } else {
    throw new Error("invalid flow step");
  }

  const mergedParticipant: Participant = {
    ...participant,
    ...(override ?? {}),
  } as Participant;

  // When guard - boolean strictness
  const whenExpression = override?.when ?? participant.when;
  if (whenExpression) {
    const shouldRun = evaluateCel(whenExpression, state.toCelContext());
    if (shouldRun !== true) {
      if (stepName) {
        state.setResult(stepName, {
          status: "skipped",
          output: "",
          duration: 0,
        });
      }
      return chain; // Skipped steps preserve chain
    }
  }

  // Resolve participant base input and flow override input separately,
  // then merge per v0.5 spec: chain < participant base input < flow override input.
  const baseInput = resolveParticipantInput(participant.input, state);
  const overrideInput = override?.input !== undefined
    ? resolveParticipantInput(override.input, state)
    : undefined;
  const mergedWithBase = mergeChainedInput(chain, baseInput);
  const mergedInput = mergeChainedInput(mergedWithBase, overrideInput);

  // Set participant-scoped input in state
  state.currentInput = mergedInput;

  const strategy = resolveErrorStrategy(override ?? null, participant, workflow.defaults ?? null);
  const timeoutMs = resolveTimeout(override ?? null, participant, workflow.defaults ?? null);
  const retryConfig = strategy === "retry" ? mergedParticipant.retry : undefined;

  const startedAt = new Date().toISOString();

  const executeOnce = async (): Promise<StepResult> => {
    const invoke = async (): Promise<StepResult> => {
      const result = await executeParticipant(
        mergedParticipant,
        mergedInput,
        {},
        basePath,
        engineExecutor,
      );

      if (result.status === "failure") {
        throw new Error(result.error || `participant '${stepName ?? "anonymous"}' failed`);
      }

      return result;
    };

    if (timeoutMs === undefined) {
      return invoke();
    }

    return withTimeout(invoke, timeoutMs);
  };

  try {
    let result: StepResult;
    let retries = 0;
    if (strategy === "retry") {
      const retryResult = await executeWithRetry(executeOnce, retryConfig, stepName ?? "<anonymous>");
      result = retryResult.result;
      retries = retryResult.attempts;
    } else {
      result = await executeOnce();
    }

    result.startedAt = result.startedAt ?? startedAt;
    result.finishedAt = result.finishedAt ?? new Date().toISOString();
    result.retries = retries;

    if (stepName) {
      state.setResult(stepName, result);
    }

    // Update participant-scoped output and chain
    const outputValue = result.parsedOutput ?? result.output;
    state.currentOutput = outputValue;
    return outputValue;
  } catch (error) {
    const message = String((error as Error)?.message ?? error);
    const finishedAt = new Date().toISOString();

    if (strategy === "skip") {
      const skipResult: StepResult = {
        status: "skipped",
        output: "",
        error: message,
        duration: 0,
        startedAt,
        finishedAt,
      };
      if (stepName) {
        state.setResult(stepName, skipResult);
      }
      return chain; // Skipped steps preserve chain
    }

    if (strategy !== "fail" && strategy !== "retry") {
      // Fallback to another participant
      const fallbackName = strategy;
      if (fallbackStack.includes(fallbackName)) {
        throw new Error(`fallback cycle detected on participant '${fallbackName}'`);
      }

      // Keep original step as failure (Go runner behavior)
      if (stepName) {
        state.setResult(stepName, {
          status: "failure",
          output: "",
          error: message,
          duration: 0,
          startedAt,
          finishedAt,
        });
      }

      // Execute fallback
      const fallbackResult = await executeStep(
        workflow,
        state,
        fallbackName,
        basePath,
        engineExecutor,
        [...fallbackStack, stepName ?? "<anonymous>"],
        chain,
      );

      return fallbackResult;
    }

    if (stepName) {
      state.setResult(stepName, {
        status: "failure",
        output: "",
        error: message,
        duration: 0,
        startedAt,
        finishedAt,
      });
    }

    throw error;
  }
}

export async function executeSequential(
  workflow: Workflow,
  state: WorkflowState,
  steps: unknown[],
  basePath = process.cwd(),
  engineExecutor?: WorkflowEngineExecutor,
  chain?: unknown,
): Promise<unknown> {
  let currentChain = chain;
  for (const step of steps) {
    // Import executeControlStep dynamically to avoid circular dependency
    const { executeControlStep } = await import("./control");
    currentChain = await executeControlStep(workflow, state, step, basePath, engineExecutor, currentChain);
  }
  return currentChain;
}
