import { test, expect } from "bun:test";
import { parseWorkflow } from "../../src/parser/index";
import { executeWorkflow } from "../../src/engine/engine";

test("integration: loop with max iterations", async () => {
  const yaml = `
name: loop-max
participants:
  echo:
    type: exec
    run: echo iter
flow:
  - loop:
      max: 3
      steps:
        - echo
`;

  const wf = parseWorkflow(yaml);
  const res = await executeWorkflow(wf, {});

  expect(res.success).toBe(true);
  expect(res.steps.echo).toBeDefined();
  expect(res.steps.echo.status).toBe("success");
});
