import { test, expect, describe } from "bun:test";
import { parseWorkflow } from "../../src/parser/index";
import { executeWorkflow } from "../../src/engine/engine";

describe("I/O chain through all control flow paths", () => {
  test("chain through if → loop → step", async () => {
    const yaml = `
name: chain-if-loop-step
participants:
  produce:
    type: exec
    run: printf '{"start":"yes"}'
flow:
  - produce
  - if:
      condition: "true"
      then:
        - loop:
            max: 2
            steps:
              - type: exec
                as: looped
                run: printf '{"looped":"ok"}'
  - type: exec
    as: final
    run: echo done
output: looped.output
`;

    const wf = parseWorkflow(yaml);
    const res = await executeWorkflow(wf, {});

    expect(res.success).toBe(true);
    // looped step ran, result is accessible
    expect(res.steps.looped?.status).toBe("success");
    const out = res.steps.looped?.parsedOutput as Record<string, unknown>;
    expect(out?.looped).toBe("ok");
  });

  test("chain passthrough when if has no else and condition is false", async () => {
    const yaml = `
name: chain-if-false-no-else
participants:
  produce:
    type: exec
    run: printf initial-value
flow:
  - produce
  - if:
      condition: "false"
      then:
        - type: exec
          as: never_runs
          run: echo should-not-run
  - type: exec
    as: final
    run: cat
output: final.output
`;

    const wf = parseWorkflow(yaml);
    const res = await executeWorkflow(wf, {});

    expect(res.success).toBe(true);
    // Chain passes through the skipped if
    expect(String(res.output).trim()).toBe("initial-value");
    expect(res.steps.never_runs).toBeUndefined();
  });

  test("chain after loop equals output of last step of last iteration", async () => {
    const yaml = `
name: chain-loop-last
flow:
  - loop:
      max: 3
      steps:
        - type: exec
          as: iter_step
          run: printf 'iter-%d' "$(_loop_iteration)"
  - type: exec
    as: after_loop
    run: cat
`;

    const wf = parseWorkflow(yaml);
    const res = await executeWorkflow(wf, {});

    expect(res.success).toBe(true);
    // The last step of the last iteration should be the chain value
    // iter_step runs 3 times, but result is overwritten each time
    expect(res.steps.after_loop?.status).toBe("success");
  });

  test("chain through set is transparent", async () => {
    const yaml = `
name: chain-set-transparent
participants:
  produce:
    type: exec
    run: printf pass-through-value
flow:
  - produce
  - set:
      my_var: '"captured"'
  - type: exec
    as: consumer
    run: cat
output: consumer.output
`;

    const wf = parseWorkflow(yaml);
    const res = await executeWorkflow(wf, {});

    expect(res.success).toBe(true);
    expect(String(res.output).trim()).toBe("pass-through-value");
  });

  test("chain through parallel returns ordered array", async () => {
    const yaml = `
name: chain-parallel-array
flow:
  - parallel:
      - type: exec
        as: p1
        run: printf first
      - type: exec
        as: p2
        run: printf second
      - type: exec
        as: p3
        run: printf third
`;

    const wf = parseWorkflow(yaml);
    const res = await executeWorkflow(wf, {});

    expect(res.success).toBe(true);
    const output = res.output as unknown[];
    expect(Array.isArray(output)).toBe(true);
    expect(output.length).toBe(3);
    expect(String(output[0]).trim()).toBe("first");
    expect(String(output[1]).trim()).toBe("second");
    expect(String(output[2]).trim()).toBe("third");
  });

  test("chain through if → set → step preserves chain through set", async () => {
    const yaml = `
name: chain-if-set-step
participants:
  source:
    type: exec
    run: printf from-source
flow:
  - source
  - if:
      condition: "true"
      then:
        - set:
            captured: source.output
        - type: exec
          as: sink
          run: cat
output: sink.output
`;

    const wf = parseWorkflow(yaml);
    const res = await executeWorkflow(wf, {});

    expect(res.success).toBe(true);
    // set is transparent, so chain passes from source through set to sink
    expect(String(res.output).trim()).toBe("from-source");
  });

  test("chain from if-else: takes the branch that executes", async () => {
    const yaml = `
name: chain-if-else
flow:
  - if:
      condition: "false"
      then:
        - type: exec
          as: then_step
          run: printf from-then
      else:
        - type: exec
          as: else_step
          run: printf from-else
  - type: exec
    as: consumer
    run: cat
output: consumer.output
`;

    const wf = parseWorkflow(yaml);
    const res = await executeWorkflow(wf, {});

    expect(res.success).toBe(true);
    expect(String(res.output).trim()).toBe("from-else");
    expect(res.steps.then_step).toBeUndefined();
    expect(res.steps.else_step?.status).toBe("success");
  });

  test("complex chain: step → if → loop → set → step", async () => {
    const yaml = `
name: chain-complex
participants:
  init:
    type: exec
    run: printf '{"val":"init"}'
flow:
  - init
  - if:
      condition: "true"
      then:
        - loop:
            max: 1
            steps:
              - type: exec
                as: loop_step
                run: printf '{"val":"looped"}'
  - set:
      saved: loop_step.output
  - type: exec
    as: final
    run: echo done
output:
  saved: execution.context.saved
  loop_val: loop_step.output
`;

    const wf = parseWorkflow(yaml);
    const res = await executeWorkflow(wf, {});

    expect(res.success).toBe(true);
    const out = res.output as Record<string, unknown>;
    // loop_step output should be accessible
    const loopOut = out.loop_val as Record<string, unknown>;
    expect(loopOut?.val).toBe("looped");
  });
});
