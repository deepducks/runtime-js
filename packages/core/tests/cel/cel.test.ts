import { test, expect } from "bun:test";
import { evaluateCel, evaluateCelStrict, validateCelExpression } from "../../src/cel/index";

test("CEL: validate valid expression", () => {
  const result = validateCelExpression("1 + 2");
  expect(result.valid).toBe(true);
});

test("CEL: validate invalid expression", () => {
  const result = validateCelExpression("1 +");
  expect(result.valid).toBe(false);
  expect(result.error).toBeDefined();
});

test("CEL: evaluate simple arithmetic", () => {
  const result = evaluateCel("1 + 2", {});
  expect(result).toBe(3);
});

test("CEL: evaluate with context", () => {
  const result = evaluateCel("x + y", { x: 10, y: 20 });
  expect(result).toBe(30);
});

test("CEL: workflow.inputs namespace", () => {
  const ctx = {
    workflow: { inputs: { name: "test" } },
  };
  const result = evaluateCel("workflow.inputs.name", ctx);
  expect(result).toBe("test");
});

test("CEL: step output access", () => {
  const ctx = {
    step1: { output: "hello", status: "success" },
  };
  const result = evaluateCel("step1.output", ctx);
  expect(result).toBe("hello");
});

test("CEL: boolean strictness - evaluateCelStrict throws for non-boolean", () => {
  expect(() => evaluateCelStrict("1 + 2", {})).toThrow(/must evaluate to boolean/);
});

test("CEL: boolean strictness - evaluateCelStrict works for boolean", () => {
  expect(evaluateCelStrict("true", {})).toBe(true);
  expect(evaluateCelStrict("false", {})).toBe(false);
});

test("CEL: non-string input returns as-is", () => {
  const result = evaluateCel(42, {});
  expect(result).toBe(42);
});

test("CEL: expression cache reuses parsed results", () => {
  // Evaluating same expression twice should work (cache hit)
  const r1 = evaluateCel("1 + 1", {});
  const r2 = evaluateCel("1 + 1", {});
  expect(r1).toBe(2);
  expect(r2).toBe(2);
});

test("CEL: now variable is available as ISO string", () => {
  const ctx = { now: new Date().toISOString() };
  const result = evaluateCel("now", ctx);
  expect(typeof result).toBe("string");
  expect((result as string).length).toBeGreaterThan(0);
});
