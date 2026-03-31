import { test, expect } from "bun:test";
import { validateSchema } from "../../src/parser/schema";

test("valid workflow passes schema", () => {
  const wf = { participants: { p: { type: "exec", run: "echo ok" } }, flow: ["p"] };
  const res = validateSchema(wf);
  expect(res.valid).toBe(true);
  expect(res.errors.length).toBe(0);
});

test("empty flow fails", () => {
  const wf = { flow: [] };
  const res = validateSchema(wf);
  expect(res.valid).toBe(false);
  expect(res.errors.length).toBeGreaterThan(0);
});

test("minimal anonymous inline passes schema", () => {
  const wf = { flow: [{ type: "exec", run: "echo ok" }] };
  const res = validateSchema(wf);
  expect(res.valid).toBe(true);
});

test("type: agent is rejected by schema", () => {
  const wf = { participants: { p: { type: "agent" } }, flow: ["p"] };
  const res = validateSchema(wf);
  expect(res.valid).toBe(false);
});

test("type: human is rejected by schema", () => {
  const wf = { participants: { p: { type: "human" } }, flow: ["p"] };
  const res = validateSchema(wf);
  expect(res.valid).toBe(false);
});

test("method field validates enum", () => {
  const wf = { flow: [{ type: "http", url: "http://example.com", method: "INVALID" }] };
  const res = validateSchema(wf);
  expect(res.valid).toBe(false);
});

test("valid method passes", () => {
  const wf = { flow: [{ type: "http", url: "http://example.com", method: "POST" }] };
  const res = validateSchema(wf);
  expect(res.valid).toBe(true);
});
