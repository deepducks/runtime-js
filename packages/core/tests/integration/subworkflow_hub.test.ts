import { test, expect, describe } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runWorkflowFromFile } from "../../src/engine/engine";
import { MemoryHub } from "../../src/eventhub/memory";

describe("sub-workflow hub event propagation", () => {
  test("event emitted in sub-workflow is visible to parent wait", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "duckflux-subwf-hub-"));

    try {
      // Child workflow emits an event
      const childYaml = `
name: child-emitter
flow:
  - type: emit
    event: child.done
    payload:
      result: '"from-child"'
`;
      await writeFile(join(tempDir, "child.yaml"), childYaml, "utf-8");

      // Parent workflow calls child, then waits for the event
      const parentYaml = `
name: parent-waiter
participants:
  call_child:
    type: workflow
    path: child.yaml
flow:
  - call_child
  - wait:
      event: child.done
      timeout: 2s
output: event.result
`;
      const parentPath = join(tempDir, "parent.yaml");
      await writeFile(parentPath, parentYaml, "utf-8");

      const hub = new MemoryHub();
      const res = await runWorkflowFromFile(parentPath, {}, { hub });
      await hub.close();

      expect(res.success).toBe(true);
      expect(res.output).toBe("from-child");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("execution.context is isolated between parent and sub-workflow", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "duckflux-subwf-ctx-"));

    try {
      // Child sets a context variable
      const childYaml = `
name: child-sets-ctx
flow:
  - set:
      child_var: '"child-value"'
  - type: exec
    as: child_step
    run: echo child-done
output: child_step.output
`;
      await writeFile(join(tempDir, "child.yaml"), childYaml, "utf-8");

      // Parent sets its own context variable, calls child, checks its context is unchanged
      const parentYaml = `
name: parent-checks-ctx
participants:
  call_child:
    type: workflow
    path: child.yaml
flow:
  - set:
      parent_var: '"parent-value"'
  - call_child
  - type: exec
    as: verify
    run: echo ok
output:
  parent_var: execution.context.parent_var
  child_result: call_child.output
`;
      const parentPath = join(tempDir, "parent.yaml");
      await writeFile(parentPath, parentYaml, "utf-8");

      const hub = new MemoryHub();
      const res = await runWorkflowFromFile(parentPath, {}, { hub });
      await hub.close();

      expect(res.success).toBe(true);
      const out = res.output as Record<string, unknown>;
      // Parent context should still have parent_var
      expect(out.parent_var).toBe("parent-value");
      // Child result should be available via step output
      expect(String(out.child_result).trim()).toBe("child-done");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("circular sub-workflow is detected and throws", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "duckflux-subwf-circ-"));

    try {
      // Workflow that calls itself
      const selfRefYaml = `
name: self-referencing
participants:
  recurse:
    type: workflow
    path: self.yaml
flow:
  - recurse
`;
      const selfPath = join(tempDir, "self.yaml");
      await writeFile(selfPath, selfRefYaml, "utf-8");

      const hub = new MemoryHub();
      await expect(runWorkflowFromFile(selfPath, {}, { hub })).rejects.toThrow(
        /circular sub-workflow/,
      );
      await hub.close();
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("indirect circular sub-workflow (A -> B -> A) is detected", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "duckflux-subwf-circ2-"));

    try {
      const aYaml = `
name: workflow-a
participants:
  call_b:
    type: workflow
    path: b.yaml
flow:
  - call_b
`;
      await writeFile(join(tempDir, "a.yaml"), aYaml, "utf-8");

      const bYaml = `
name: workflow-b
participants:
  call_a:
    type: workflow
    path: a.yaml
flow:
  - call_a
`;
      await writeFile(join(tempDir, "b.yaml"), bYaml, "utf-8");

      const hub = new MemoryHub();
      await expect(runWorkflowFromFile(join(tempDir, "a.yaml"), {}, { hub })).rejects.toThrow(
        /circular sub-workflow/,
      );
      await hub.close();
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
