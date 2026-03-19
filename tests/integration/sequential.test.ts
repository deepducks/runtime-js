import { test, expect } from "bun:test";
import { parseWorkflow } from "../../src/parser/index";
import { executeWorkflow } from "../../src/engine/engine";

test("integration: sequential workflow via executeWorkflow", async () => {
  const yaml = `
name: seq-integration
participants:
  a:
    type: exec
    run: echo a
  b:
    type: exec
    run: echo b
  c:
    type: exec
    run: echo c
flow:
  - a
  - b
  - c
output: a.output
`;

  const wf = parseWorkflow(yaml);
  const res = await executeWorkflow(wf, {});

  expect(res.success).toBe(true);
  expect(res.steps.a).toBeDefined();
  expect(res.steps.b).toBeDefined();
  expect(res.steps.c).toBeDefined();
  expect(res.steps.a.status).toBe("success");
  expect(res.steps.b.status).toBe("success");
  expect(res.steps.c.status).toBe("success");
  expect(String(res.output).includes("a")).toBe(true);
});
