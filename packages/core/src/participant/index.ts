import type { EventHub } from "../eventhub/types";
import type { EmitParticipant, McpParticipant, Participant, StepResult, WorkflowParticipant } from "../model/index";
import { executeEmit } from "./emit";
import { executeExec } from "./exec";
import executeHttp from "./http";
import { executeMcp } from "./mcp";
import { executeSubWorkflow } from "./workflow";
import type { AncestorPaths, WorkflowEngineExecutor } from "./workflow";

export type ExecutorFunction = (
  participant: Participant,
  input: unknown,
  env: Record<string, string>,
  basePath?: string,
  engineExecutor?: WorkflowEngineExecutor,
  hub?: EventHub,
  celContext?: Record<string, unknown>,
  ancestorPaths?: AncestorPaths,
) => Promise<StepResult>;

const executors: Record<string, ExecutorFunction> = {
  exec: async (participant, input, env) => executeExec(participant as Parameters<typeof executeExec>[0], input, env),
  http: async (participant, input) => executeHttp(participant as Parameters<typeof executeHttp>[0], input as string | undefined),
  workflow: async (participant, input, _env, basePath, engineExecutor, _hub, _celContext, ancestorPaths) => {
    if (!basePath) {
      throw new Error("workflow participant execution requires basePath");
    }
    if (!engineExecutor) {
      throw new Error("workflow participant execution requires engineExecutor");
    }
    return executeSubWorkflow(participant as WorkflowParticipant, input, basePath, engineExecutor, ancestorPaths);
  },
  mcp: async (participant, input) => executeMcp(participant as McpParticipant, input),
  emit: async (participant, _input, _env, _basePath, _engineExecutor, hub, celContext) => {
    if (!hub) {
      throw new Error("emit participant requires an event hub but none was provided");
    }
    if (!celContext) {
      throw new Error("emit participant requires CEL context");
    }
    return executeEmit(participant as EmitParticipant, celContext, hub);
  },
};

export async function executeParticipant(
  participant: Participant,
  input: unknown,
  env: Record<string, string> = {},
  basePath?: string,
  engineExecutor?: WorkflowEngineExecutor,
  hub?: EventHub,
  celContext?: Record<string, unknown>,
  ancestorPaths?: AncestorPaths,
): Promise<StepResult> {
  const executor = executors[participant.type];
  if (!executor) {
    throw new Error(`participant type '${participant.type}' is not yet implemented`);
  }

  return executor(participant, input, env, basePath, engineExecutor, hub, celContext, ancestorPaths);
}
