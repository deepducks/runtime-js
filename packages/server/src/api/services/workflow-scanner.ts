import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import yaml from "yaml";
import type { InputDefinition, Workflow } from "@duckflux/core";

export interface WorkflowMeta {
  id: string;
  filePath: string;
  relativePath: string;
  name?: string;
  version?: string | number;
  description?: string;
  inputs?: Record<string, InputDefinition | null>;
}

export async function scanWorkflows(workflowDir: string): Promise<WorkflowMeta[]> {
  const yamlFiles = await collectYamlFiles(workflowDir);

  const results = await Promise.allSettled(
    yamlFiles.map((filePath) => parseWorkflowMeta(filePath, workflowDir))
  );

  const metas: WorkflowMeta[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") {
      metas.push(r.value);
    }
  }

  return metas.sort((a, b) => (a.name ?? a.relativePath).localeCompare(b.name ?? b.relativePath));
}

async function collectYamlFiles(dir: string): Promise<string[]> {
  let entries: Array<{ name: string; isDirectory(): boolean }>;
  try {
    const raw = await readdir(dir, { withFileTypes: true });
    entries = raw;
  } catch {
    return [];
  }

  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = await collectYamlFiles(fullPath);
      files.push(...nested);
    } else if (entry.name.endsWith(".yaml") || entry.name.endsWith(".yml")) {
      files.push(fullPath);
    }
  }
  return files;
}

async function parseWorkflowMeta(filePath: string, workflowDir: string): Promise<WorkflowMeta> {
  const content = await readFile(filePath, "utf-8");
  const workflow = yaml.parse(content) as Workflow;
  const rel = relative(workflowDir, filePath);
  const id = workflow.id ?? rel.replace(/\.(yaml|yml)$/, "");

  return {
    id,
    filePath,
    relativePath: rel,
    name: workflow.name,
    version: workflow.version,
    inputs: workflow.inputs,
  };
}
