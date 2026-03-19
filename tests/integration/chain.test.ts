import { test, expect } from "bun:test";
import { parseWorkflow } from "../../src/parser/index";
import { executeWorkflow } from "../../src/engine/engine";

test("integration: implicit I/O chain passes output between steps", async () => {
  const yaml = `
participants:
  a:
    type: exec
    run: echo '{"value":42}'
  b:
    type: exec
    run: cat
flow:
  - a
  - b
`;
  const wf = parseWorkflow(yaml);
  const res = await executeWorkflow(wf, {});
  expect(res.success).toBe(true);
  // Default output is last chain value (b's output, which received a's output via chain/stdin)
  // b receives a's parsed JSON output as stdin input, producing the same JSON on stdout
  const output = typeof res.output === "object" ? JSON.stringify(res.output) : String(res.output);
  expect(output).toContain("42");
});

test("integration: default output is last chain value when no output defined", async () => {
  const yaml = `
flow:
  - type: exec
    run: echo final-value
`;
  const wf = parseWorkflow(yaml);
  const res = await executeWorkflow(wf, {});
  expect(res.success).toBe(true);
  expect(String(res.output).trim()).toBe("final-value");
});

test("integration: parallel chain produces array of outputs", async () => {
  const yaml = `
participants:
  a:
    type: exec
    run: echo a-out
  b:
    type: exec
    run: echo b-out
flow:
  - parallel:
      - a
      - b
`;
  const wf = parseWorkflow(yaml);
  const res = await executeWorkflow(wf, {});
  expect(res.success).toBe(true);
  // Parallel output is array of branch outputs
  expect(Array.isArray(res.output)).toBe(true);
  const arr = res.output as unknown[];
  expect(arr.length).toBe(2);
});
