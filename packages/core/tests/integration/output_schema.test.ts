import { test, expect, describe } from "bun:test";
import { parseWorkflow } from "../../src/parser/index";
import { executeWorkflow } from "../../src/engine/engine";

describe("participant output schema validation", () => {
  test("participant with valid output schema passes", async () => {
    const yaml = `
participants:
  greet:
    type: exec
    run: echo '{"message":"hello","code":200}'
    output:
      message:
        type: string
        required: true
      code:
        type: integer
flow:
  - greet
output: greet.output
`;
    const wf = parseWorkflow(yaml);
    const res = await executeWorkflow(wf, {});
    expect(res.success).toBe(true);
  });

  test("participant with invalid output schema fails and follows onError", async () => {
    const yaml = `
participants:
  greet:
    type: exec
    run: echo '{"message":123}'
    onError: skip
    output:
      message:
        type: string
        required: true
flow:
  - greet
`;
    const wf = parseWorkflow(yaml);
    const res = await executeWorkflow(wf, {});
    expect(res.success).toBe(true);
    expect(res.steps.greet.status).toBe("skipped");
  });

  test("participant with missing required output field fails", async () => {
    const yaml = `
participants:
  greet:
    type: exec
    run: echo '{"other":"value"}'
    onError: skip
    output:
      message:
        type: string
        required: true
flow:
  - greet
`;
    const wf = parseWorkflow(yaml);
    const res = await executeWorkflow(wf, {});
    expect(res.success).toBe(true);
    expect(res.steps.greet.status).toBe("skipped");
  });

  test("participant output schema failure with onError fail propagates error", async () => {
    const yaml = `
participants:
  greet:
    type: exec
    run: echo '{"message":123}'
    output:
      message:
        type: string
        required: true
flow:
  - greet
`;
    const wf = parseWorkflow(yaml);
    await expect(executeWorkflow(wf, {})).rejects.toThrow("output validation failed");
  });
});

describe("set reserved key runtime validation", () => {
  test("set with reserved key is rejected at runtime", async () => {
    const yaml = `
flow:
  - set:
      output: "'bad'"
  - as: noop
    type: exec
    run: echo ok
    timeout: 5s
`;
    const wf = parseWorkflow(yaml);
    await expect(executeWorkflow(wf, {})).rejects.toThrow("set key 'output' uses a reserved name");
  });

  test("set with valid key works", async () => {
    const yaml = `
flow:
  - set:
      myVar: "'good'"
  - as: noop
    type: exec
    run: echo ok
    timeout: 5s
output: execution.context.myVar
`;
    const wf = parseWorkflow(yaml);
    const res = await executeWorkflow(wf, {});
    expect(res.success).toBe(true);
    expect(res.output).toBe("good");
  });
});
