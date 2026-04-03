import { test, expect } from "bun:test";
import { parseWorkflow } from "../../src/parser/index";
import { executeWorkflow } from "../../src/engine/engine";

test("integration: error handling fallback", async () => {
  const yaml = `
name: fallback-on-error
participants:
  main:
    type: exec
    run: sh -c "echo fail >&2; exit 1"
    onError: fixer
  fixer:
    type: exec
    run: echo fixed
flow:
  - main
`;

  const workflow = parseWorkflow(yaml);
  const result = await executeWorkflow(workflow, {});

  expect(result.success).toBe(false);
  // v0.3: original step preserved as failure
  expect(result.steps.main?.status).toBe("failure");
  // Fixer ran successfully
  expect(result.steps.fixer?.status).toBe("success");
  expect(result.steps.fixer?.output.includes("fixed")).toBe(true);
});
