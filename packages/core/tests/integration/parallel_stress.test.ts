import { test, expect, describe } from "bun:test";
import { parseWorkflow } from "../../src/parser/index";
import { executeWorkflow } from "../../src/engine/engine";

describe("parallel stress tests", () => {
  test("parallel + timeout: fast branches complete, slow branch times out", async () => {
    const yaml = `
name: parallel-timeout-stress
participants:
  fast:
    type: exec
    run: echo fast
  slow:
    type: exec
    run: sh -c "sleep 5; echo slow"
    timeout: 50ms
    onError: skip
flow:
  - parallel:
      - fast
      - slow
`;

    const wf = parseWorkflow(yaml);
    const res = await executeWorkflow(wf, {});

    expect(res.success).toBe(true);
    expect(res.steps.fast?.status).toBe("success");
    expect(res.steps.slow?.status).toBe("skipped");
  });

  test("parallel + error: one branch fails, others should still record", async () => {
    const yaml = `
name: parallel-error-stress
participants:
  ok1:
    type: exec
    run: echo ok1
  ok2:
    type: exec
    run: echo ok2
  fail_step:
    type: exec
    run: exit 1
    onError: skip
flow:
  - parallel:
      - ok1
      - fail_step
      - ok2
`;

    const wf = parseWorkflow(yaml);
    const res = await executeWorkflow(wf, {});

    expect(res.success).toBe(true);
    expect(res.steps.ok1?.status).toBe("success");
    expect(res.steps.ok2?.status).toBe("success");
    expect(res.steps.fail_step?.status).toBe("skipped");
  });

  test("parallel with many branches runs concurrently", async () => {
    const yaml = `
name: parallel-many-branches
flow:
  - parallel:
      - type: exec
        as: b1
        run: sh -c "sleep 0.1; echo b1"
      - type: exec
        as: b2
        run: sh -c "sleep 0.1; echo b2"
      - type: exec
        as: b3
        run: sh -c "sleep 0.1; echo b3"
      - type: exec
        as: b4
        run: sh -c "sleep 0.1; echo b4"
      - type: exec
        as: b5
        run: sh -c "sleep 0.1; echo b5"
`;

    const wf = parseWorkflow(yaml);
    const res = await executeWorkflow(wf, {});

    expect(res.success).toBe(true);
    // If sequential: ~500ms. If parallel: ~100ms. Allow some margin.
    expect(res.duration).toBeLessThan(400);
    expect(Array.isArray(res.output)).toBe(true);
    expect((res.output as unknown[]).length).toBe(5);
  });

  test("parallel + retry: retrying branch doesn't block others", async () => {
    const yaml = `
name: parallel-retry
participants:
  reliable:
    type: exec
    run: echo reliable
  flaky:
    type: exec
    run: sh -c "exit 1"
    onError: retry
    retry:
      max: 2
      backoff: 10ms
flow:
  - parallel:
      - reliable
      - flaky:
          onError: skip
`;

    const wf = parseWorkflow(yaml);
    const res = await executeWorkflow(wf, {});

    expect(res.success).toBe(true);
    expect(res.steps.reliable?.status).toBe("success");
  });

  test("nested parallel executes correctly", async () => {
    const yaml = `
name: nested-parallel
flow:
  - parallel:
      - type: exec
        as: outer1
        run: echo outer1
      - parallel:
          - type: exec
            as: inner1
            run: echo inner1
          - type: exec
            as: inner2
            run: echo inner2
`;

    const wf = parseWorkflow(yaml);
    const res = await executeWorkflow(wf, {});

    expect(res.success).toBe(true);
    expect(res.steps.outer1?.status).toBe("success");
    expect(res.steps.inner1?.status).toBe("success");
    expect(res.steps.inner2?.status).toBe("success");
  });

  test("parallel + timeout propagation: branch timeout triggers abort", async () => {
    const yaml = `
name: parallel-abort
participants:
  fast_done:
    type: exec
    run: echo done
  will_timeout:
    type: exec
    run: sh -c "sleep 10"
    timeout: 30ms
flow:
  - parallel:
      - fast_done
      - will_timeout
`;

    const wf = parseWorkflow(yaml);
    await expect(executeWorkflow(wf, {})).rejects.toBeDefined();
  });
});
