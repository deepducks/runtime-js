import { readFile } from "node:fs/promises";
import yaml from "yaml";
import type { Workflow } from "../model/index";

export function parseWorkflow(yamlContent: string): Workflow {
  const parsed = yaml.parse(yamlContent) as Workflow;
  return parsed;
}

export async function parseWorkflowFile(filePath: string): Promise<Workflow> {
  const content = await readFile(filePath, "utf-8");
  return parseWorkflow(content);
}
