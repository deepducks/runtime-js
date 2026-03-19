import { test, expect } from "bun:test";
import { parseWorkflow } from "../../src/parser/parser";

test("v0.3: participants is optional", () => {
  const yaml = `flow:\n  - type: exec\n    run: echo hello`;
  const wf = parseWorkflow(yaml);
  expect(wf.participants).toBeUndefined();
  expect(wf.flow.length).toBe(1);
});

test("v0.3: inline participant with as", () => {
  const yaml = `flow:\n  - type: exec\n    as: step1\n    run: echo hello`;
  const wf = parseWorkflow(yaml);
  const step = wf.flow[0] as any;
  expect(step.type).toBe("exec");
  expect(step.as).toBe("step1");
});
