import { test, expect } from "bun:test";
import { WorkflowState } from "../../src/engine/index";

test("WorkflowState push/increment/pop loop and context", () => {
  const state = new WorkflowState({ foo: "bar" });
  expect(state.currentLoopIndex()).toBe(0);
  state.pushLoop();
  expect(state.currentLoopIndex()).toBe(0);
  state.incrementLoop();
  expect(state.currentLoopIndex()).toBe(1);
  state.incrementLoop();
  expect(state.currentLoopIndex()).toBe(2);
  state.popLoop();
  expect(state.currentLoopIndex()).toBe(0);

  // set a result and verify toCelContext
  state.setResult("step1", {
    status: "success",
    output: "hello",
    parsedOutput: { ok: true },
    duration: 10,
  });

  const ctx = state.toCelContext();
  // v0.3: inputs under workflow.inputs
  const workflow = ctx.workflow as { inputs: Record<string, unknown> };
  expect(workflow.inputs).toBeDefined();
  expect(workflow.inputs.foo).toBe("bar");
  // step results
  const step1 = ctx.step1 as { output: unknown };
  expect(step1).toBeDefined();
  expect(step1.output).toEqual({ ok: true });
  // loop context
  const loop = ctx.loop as { index: number };
  expect(loop.index).toBe(0);
});
