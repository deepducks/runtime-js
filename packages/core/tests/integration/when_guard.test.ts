import { test, expect } from "bun:test";
import { parseWorkflow } from "../../src/parser/index";
import { executeWorkflow } from "../../src/engine/engine";

test("integration: guard when skips step when false", async () => {
  const yaml = `
name: when-guard
participants:
  maybe:
    type: exec
    run: echo yes
    when: "false"
  after:
    type: exec
    run: echo ok
flow:
  - maybe
  - after
`;

  const wf = parseWorkflow(yaml);
  const res = await executeWorkflow(wf, {});
  expect(res.success).toBe(true);
  expect(res.steps.maybe).toBeDefined();
  expect(res.steps.maybe.status).toBe("skipped");
  expect(res.steps.after).toBeDefined();
});
