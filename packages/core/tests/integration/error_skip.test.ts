import { test, expect } from "bun:test";
import { parseWorkflow } from "../../src/parser/index";
import { executeWorkflow } from "../../src/engine/engine";

test("integration: error handling skip", async () => {
  const yaml = `
name: skip-on-error
participants:
  flaky:
    type: exec
    run: sh -c "echo boom >&2; exit 1"
    onError: skip
  after:
    type: exec
    run: echo after
flow:
  - flaky
  - after
`;

  const workflow = parseWorkflow(yaml);
  const result = await executeWorkflow(workflow, {});

  expect(result.success).toBe(true);
  expect(result.steps.flaky?.status).toBe("skipped");
  expect(result.steps.after?.status).toBe("success");
});
