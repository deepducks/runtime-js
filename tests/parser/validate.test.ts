import { test, expect } from "bun:test";
import { validateSemantic } from "../../src/parser/validate";
import type { Workflow } from "../../src/model/index";

test("semantic: reserved name rejected", async () => {
  const wf: Workflow = {
    participants: { loop: { type: "exec", run: "echo" } as any },
    flow: ["loop"],
  };
  const res = await validateSemantic(wf, "/tmp");
  expect(res.valid).toBe(false);
  expect(res.errors.some((e) => e.message.includes("reserved"))).toBe(true);
});

test("semantic: event added to reserved names", async () => {
  const wf: Workflow = {
    participants: { event: { type: "exec", run: "echo" } as any },
    flow: ["event"],
  };
  const res = await validateSemantic(wf, "/tmp");
  expect(res.valid).toBe(false);
  expect(res.errors.some((e) => e.message.includes("reserved"))).toBe(true);
});

test("semantic: inline as uniqueness - conflict with top-level", async () => {
  const wf: Workflow = {
    participants: { greet: { type: "exec", run: "echo hi" } as any },
    flow: [
      "greet",
      { type: "exec", as: "greet", run: "echo dup" } as any,
    ],
  };
  const res = await validateSemantic(wf, "/tmp");
  expect(res.valid).toBe(false);
  expect(res.errors.some((e) => e.message.includes("conflicts"))).toBe(true);
});

test("semantic: inline as uniqueness - duplicate inline names", async () => {
  const wf: Workflow = {
    flow: [
      { type: "exec", as: "step1", run: "echo a" } as any,
      { type: "exec", as: "step1", run: "echo b" } as any,
    ],
  };
  const res = await validateSemantic(wf, "/tmp");
  expect(res.valid).toBe(false);
  expect(res.errors.some((e) => e.message.includes("not unique"))).toBe(true);
});

test("semantic: emit participant requires event field", async () => {
  const wf: Workflow = {
    participants: { e: { type: "emit" } as any },
    flow: ["e"],
  };
  const res = await validateSemantic(wf, "/tmp");
  expect(res.valid).toBe(false);
  expect(res.errors.some((e) => e.message.includes("event"))).toBe(true);
});

test("semantic: flow must be non-empty", async () => {
  const wf: Workflow = {
    flow: [],
  };
  const res = await validateSemantic(wf, "/tmp");
  expect(res.valid).toBe(false);
  expect(res.errors.some((e) => e.message.includes("at least one step"))).toBe(true);
});

test("semantic: loop.as with reserved name rejected", async () => {
  const wf: Workflow = {
    participants: { echo: { type: "exec", run: "echo" } as any },
    flow: [
      { loop: { as: "input", max: 1, steps: ["echo"] } },
    ],
  };
  const res = await validateSemantic(wf, "/tmp");
  expect(res.valid).toBe(false);
  expect(res.errors.some((e) => e.message.includes("reserved"))).toBe(true);
});

test("semantic: valid workflow passes", async () => {
  const wf: Workflow = {
    participants: { echo: { type: "exec", run: "echo ok" } as any },
    flow: ["echo"],
  };
  const res = await validateSemantic(wf, "/tmp");
  expect(res.valid).toBe(true);
});
