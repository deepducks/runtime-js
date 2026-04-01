import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ExecutionTrace } from "@duckflux/core";

export async function listExecutions(traceDir: string): Promise<ExecutionTrace[]> {
  let entries: string[];
  try {
    entries = await readdir(traceDir);
  } catch {
    return [];
  }

  const jsonFiles = entries.filter((f) => f.endsWith(".json"));
  const results = await Promise.allSettled(
    jsonFiles.map((f) => readExecution(join(traceDir, f)))
  );

  const traces: ExecutionTrace[] = [];
  for (const r of results) {
    if (r.status === "fulfilled" && r.value !== null) {
      traces.push(r.value);
    }
  }

  return traces.sort((a, b) =>
    new Date(b.execution.startedAt).getTime() - new Date(a.execution.startedAt).getTime()
  );
}

export async function getExecution(
  traceDir: string,
  executionId: string
): Promise<ExecutionTrace | null> {
  return readExecution(join(traceDir, `${executionId}.json`));
}

async function readExecution(filePath: string): Promise<ExecutionTrace | null> {
  try {
    const content = await readFile(filePath, "utf-8");
    return JSON.parse(content) as ExecutionTrace;
  } catch {
    return null;
  }
}
