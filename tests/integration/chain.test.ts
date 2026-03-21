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

// --- v0.5 Input Merge on Flow Override ---

test("integration: v0.5 flow override input merges with participant base input", async () => {
  const yaml = `
participants:
  worker:
    type: exec
    run: cat
    input:
      A: '"base-a"'
flow:
  - worker:
      input:
        B: '"override-b"'
`;
  const wf = parseWorkflow(yaml);
  const res = await executeWorkflow(wf, {});
  expect(res.success).toBe(true);
  const output = res.output as Record<string, unknown>;
  expect(output.A).toBe("base-a");
  expect(output.B).toBe("override-b");
});

test("integration: v0.5 flow override input wins on key conflict", async () => {
  const yaml = `
participants:
  worker:
    type: exec
    run: cat
    input:
      X: '"base"'
flow:
  - worker:
      input:
        X: '"override"'
`;
  const wf = parseWorkflow(yaml);
  const res = await executeWorkflow(wf, {});
  expect(res.success).toBe(true);
  const output = res.output as Record<string, unknown>;
  expect(output.X).toBe("override");
});

test("integration: v0.5 three-way merge chain + base + override", async () => {
  const yaml = `
participants:
  produce:
    type: exec
    run: printf '{"C":"chain-c"}'
  consume:
    type: exec
    run: cat
    input:
      B: '"base-b"'
flow:
  - produce
  - consume:
      input:
        O: '"override-o"'
`;
  const wf = parseWorkflow(yaml);
  const res = await executeWorkflow(wf, {});
  expect(res.success).toBe(true);
  const output = res.output as Record<string, unknown>;
  expect(output.C).toBe("chain-c");
  expect(output.B).toBe("base-b");
  expect(output.O).toBe("override-o");
});

test("integration: v0.5 three-way merge conflict precedence (override > base > chain)", async () => {
  const yaml = `
participants:
  produce:
    type: exec
    run: printf '{"K":"from-chain"}'
  consume:
    type: exec
    run: cat
    input:
      K: '"from-base"'
flow:
  - produce
  - consume:
      input:
        K: '"from-override"'
`;
  const wf = parseWorkflow(yaml);
  const res = await executeWorkflow(wf, {});
  expect(res.success).toBe(true);
  const output = res.output as Record<string, unknown>;
  expect(output.K).toBe("from-override");
});
