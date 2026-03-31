import { test, expect } from "bun:test";
import { WorkflowState } from "../../src/engine/index";
import { executeSequential } from "../../src/engine/sequential";

test("executeSequential runs three exec participants in order", async () => {
  const workflow = {
    participants: {
      a: { type: "exec" as const, run: "echo a" },
      b: { type: "exec" as const, run: "echo b" },
      c: { type: "exec" as const, run: "echo c" },
    },
    flow: ["a", "b", "c"],
  };

  const state = new WorkflowState({});
  await executeSequential(workflow, state, workflow.flow, process.cwd());

  const ra = state.getResult("a");
  const rb = state.getResult("b");
  const rc = state.getResult("c");

  expect(ra).toBeDefined();
  expect(rb).toBeDefined();
  expect(rc).toBeDefined();

  expect(ra?.status).toBe("success");
  expect(rb?.status).toBe("success");
  expect(rc?.status).toBe("success");

  expect(ra?.output.includes("a")).toBe(true);
  expect(rb?.output.includes("b")).toBe(true);
  expect(rc?.output.includes("c")).toBe(true);
});
