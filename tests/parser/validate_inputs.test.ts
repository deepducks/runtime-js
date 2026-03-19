import { test, expect } from "bun:test";
import { validateInputs } from "../../src/parser/validate_inputs";

test("coercion: string '42' to integer", () => {
  const res = validateInputs({ count: { type: "integer" } }, { count: "42" });
  expect(res.result.valid).toBe(true);
  expect(res.resolved.count).toBe(42);
});

test("coercion: string 'true' to boolean", () => {
  const res = validateInputs({ flag: { type: "boolean" } }, { flag: "true" });
  expect(res.result.valid).toBe(true);
  expect(res.resolved.flag).toBe(true);
});

test("coercion: string '3.14' to number", () => {
  const res = validateInputs({ val: { type: "number" } }, { val: "3.14" });
  expect(res.result.valid).toBe(true);
  expect(res.resolved.val).toBeCloseTo(3.14);
});

test("constraint: enum validation", () => {
  const res = validateInputs(
    { color: { type: "string", enum: ["red", "blue"] } },
    { color: "green" },
  );
  expect(res.result.valid).toBe(false);
  expect(res.result.errors[0].message).toContain("one of");
});

test("constraint: minimum", () => {
  const res = validateInputs(
    { age: { type: "integer", minimum: 18 } },
    { age: 10 },
  );
  expect(res.result.valid).toBe(false);
  expect(res.result.errors[0].message).toContain(">= 18");
});

test("constraint: maximum", () => {
  const res = validateInputs(
    { score: { type: "number", maximum: 100 } },
    { score: 150 },
  );
  expect(res.result.valid).toBe(false);
});

test("constraint: minLength", () => {
  const res = validateInputs(
    { name: { type: "string", minLength: 3 } },
    { name: "ab" },
  );
  expect(res.result.valid).toBe(false);
});

test("constraint: maxLength", () => {
  const res = validateInputs(
    { name: { type: "string", maxLength: 5 } },
    { name: "toolong" },
  );
  expect(res.result.valid).toBe(false);
});

test("constraint: pattern", () => {
  const res = validateInputs(
    { code: { type: "string", pattern: "^[A-Z]{3}$" } },
    { code: "abc" },
  );
  expect(res.result.valid).toBe(false);
});

test("format: email validation", () => {
  const res = validateInputs(
    { email: { type: "string", format: "email" } },
    { email: "notanemail" },
  );
  expect(res.result.valid).toBe(false);
});

test("format: valid email passes", () => {
  const res = validateInputs(
    { email: { type: "string", format: "email" } },
    { email: "test@example.com" },
  );
  expect(res.result.valid).toBe(true);
});

test("null definition treated as string with no schema", () => {
  const res = validateInputs({ name: null }, { name: "anything" });
  expect(res.result.valid).toBe(true);
});

test("required input missing", () => {
  const res = validateInputs({ name: { type: "string", required: true } }, {});
  expect(res.result.valid).toBe(false);
});

test("default value applied when missing", () => {
  const res = validateInputs(
    { name: { type: "string", default: "world" } },
    {},
  );
  expect(res.result.valid).toBe(true);
  expect(res.resolved.name).toBe("world");
});
