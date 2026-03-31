import { test, expect } from "bun:test";
import { parseWorkflow } from "../../src/parser/index";
import { executeWorkflow } from "../../src/engine/engine";

test("integration: anonymous inline participant executes", async () => {
  const yaml = `
flow:
  - type: exec
    run: echo inline-ok
`;
  const wf = parseWorkflow(yaml);
  const res = await executeWorkflow(wf, {});
  expect(res.success).toBe(true);
  // Anonymous inline: chain carries output
  expect(String(res.output).trim()).toBe("inline-ok");
});

test("integration: named inline participant stores result", async () => {
  const yaml = `
flow:
  - type: exec
    as: step1
    run: echo named-ok
output: step1.output
`;
  const wf = parseWorkflow(yaml);
  const res = await executeWorkflow(wf, {});
  expect(res.success).toBe(true);
  expect(res.steps.step1).toBeDefined();
  expect(res.steps.step1.status).toBe("success");
  expect(String(res.output).trim()).toBe("named-ok");
});

test("integration: mixed named participants and inline", async () => {
  const yaml = `
participants:
  greet:
    type: exec
    run: echo hello
flow:
  - greet
  - type: exec
    as: inline1
    run: echo world
output: inline1.output
`;
  const wf = parseWorkflow(yaml);
  const res = await executeWorkflow(wf, {});
  expect(res.success).toBe(true);
  expect(res.steps.greet).toBeDefined();
  expect(res.steps.inline1).toBeDefined();
  expect(String(res.output).trim()).toBe("world");
});
