import { dirname, resolve } from "node:path";
import { evaluateCel } from "../cel/index";
import type { Workflow, WorkflowResult } from "../model/index";
import { parseWorkflowFile } from "../parser/parser";
import { validateSchema } from "../parser/schema";
import { validateSemantic } from "../parser/validate";
import { validateInputs } from "../parser/validate_inputs";
import type { WorkflowEngineExecutor } from "../participant/workflow";
import { executeControlStep } from "./control";
import { WorkflowState } from "./state";

export interface EventHub {
  publish(event: string, payload: unknown): Promise<void>;
  publishAndWaitAck(event: string, payload: unknown, timeoutMs: number): Promise<void>;
  subscribe(event: string, signal?: AbortSignal): AsyncIterable<{ name: string; payload: unknown }>;
  close(): Promise<void>;
}

export interface ExecuteOptions {
  hub?: EventHub;
  cwd?: string;
  verbose?: boolean;
  quiet?: boolean;
}

export async function executeWorkflow(
  workflow: Workflow,
  inputs: Record<string, unknown> = {},
  basePath = process.cwd(),
  options: ExecuteOptions = {},
): Promise<WorkflowResult> {
  const { result: inputResult, resolved } = validateInputs(workflow.inputs, inputs);
  if (!inputResult.valid) {
    throw new Error(`input validation failed: ${JSON.stringify(inputResult.errors)}`);
  }

  const state = new WorkflowState(resolved);

  // Set workflow metadata
  state.workflowMeta = {
    id: workflow.id,
    name: workflow.name,
    version: workflow.version,
  };
  if (options.cwd) {
    state.executionMeta.cwd = options.cwd;
  }

  const startedAt = performance.now();

  const engineExecutor: WorkflowEngineExecutor = async (subWorkflow, subInputs, subBasePath) => {
    // Sub-workflows share parent hub
    return executeWorkflow(subWorkflow, subInputs, subBasePath, options);
  };

  // Execute flow with chain threading
  let chain: unknown;
  for (const step of workflow.flow) {
    chain = await executeControlStep(workflow, state, step, basePath, engineExecutor, chain);
  }

  // Output resolution
  let output: unknown;
  if (workflow.output !== undefined) {
    output = state.resolveOutput(workflow.output, evaluateCel);
  } else {
    // Default: return final chain value
    output = chain;
  }

  const steps = state.getAllResults();
  const success = !Object.values(steps).some((step) => step.status === "failure");

  state.executionMeta.status = success ? "success" : "failure";

  return {
    success,
    output,
    steps,
    duration: Math.max(0, performance.now() - startedAt),
  };
}

export async function runWorkflowFromFile(
  filePath: string,
  inputs: Record<string, unknown> = {},
  options: ExecuteOptions = {},
): Promise<WorkflowResult> {
  const workflow = await parseWorkflowFile(filePath);

  const schemaValidation = validateSchema(workflow);
  if (!schemaValidation.valid) {
    throw new Error(`schema validation failed: ${JSON.stringify(schemaValidation.errors)}`);
  }

  const workflowBasePath = dirname(resolve(filePath));
  const semanticValidation = await validateSemantic(workflow, workflowBasePath);
  if (!semanticValidation.valid) {
    throw new Error(`semantic validation failed: ${JSON.stringify(semanticValidation.errors)}`);
  }

  return executeWorkflow(workflow, inputs, workflowBasePath, options);
}
