import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { listExecutions, getExecution } from "../src/api/services/trace-reader.ts";
import type { ExecutionTrace } from "@duckflux/core";

function makeTrace(id: string, status: "success" | "failure" | "running" = "success"): ExecutionTrace {
  return {
    execution: {
      id,
      workflowId: "test-workflow",
      workflowName: "Test Workflow",
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      duration: 100,
      status,
      inputs: {},
      output: null,
    },
    steps: [],
  };
}

describe("trace-reader", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "duckflux-test-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("returns empty array for missing directory", async () => {
    const result = await listExecutions("/nonexistent/path");
    expect(result).toEqual([]);
  });

  it("returns empty array for empty directory", async () => {
    const result = await listExecutions(dir);
    expect(result).toEqual([]);
  });

  it("lists trace files sorted by startedAt descending", async () => {
    const older = makeTrace("exec-old");
    older.execution.startedAt = "2024-01-01T00:00:00.000Z";
    const newer = makeTrace("exec-new");
    newer.execution.startedAt = "2024-06-01T00:00:00.000Z";

    await writeFile(join(dir, "exec-old.json"), JSON.stringify(older));
    await writeFile(join(dir, "exec-new.json"), JSON.stringify(newer));

    const result = await listExecutions(dir);
    expect(result).toHaveLength(2);
    expect(result[0].execution.id).toBe("exec-new");
    expect(result[1].execution.id).toBe("exec-old");
  });

  it("skips malformed JSON files without aborting", async () => {
    await writeFile(join(dir, "valid.json"), JSON.stringify(makeTrace("valid")));
    await writeFile(join(dir, "bad.json"), "not json at all");

    const result = await listExecutions(dir);
    expect(result).toHaveLength(1);
    expect(result[0].execution.id).toBe("valid");
  });

  it("handles partial/in-progress traces (no finishedAt)", async () => {
    const partial: ExecutionTrace = {
      execution: {
        id: "running-exec",
        startedAt: new Date().toISOString(),
        finishedAt: "",
        duration: 0,
        status: "running",
        inputs: {},
        output: null,
      },
      steps: [],
    };
    await writeFile(join(dir, "running-exec.json"), JSON.stringify(partial));

    const result = await listExecutions(dir);
    expect(result).toHaveLength(1);
    expect(result[0].execution.status).toBe("running");
  });

  it("getExecution returns null for missing file", async () => {
    const result = await getExecution(dir, "nonexistent");
    expect(result).toBeNull();
  });

  it("getExecution returns trace for existing file", async () => {
    const trace = makeTrace("my-exec");
    await writeFile(join(dir, "my-exec.json"), JSON.stringify(trace));

    const result = await getExecution(dir, "my-exec");
    expect(result?.execution.id).toBe("my-exec");
  });
});
