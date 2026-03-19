import { test, expect } from "bun:test";
import { parseDuration } from "../../src/engine/errors";

test("parseDuration: milliseconds", () => {
  expect(parseDuration("100ms")).toBe(100);
});

test("parseDuration: seconds", () => {
  expect(parseDuration("5s")).toBe(5000);
});

test("parseDuration: minutes", () => {
  expect(parseDuration("2m")).toBe(120000);
});

test("parseDuration: hours", () => {
  expect(parseDuration("1h")).toBe(3600000);
});

test("parseDuration: days", () => {
  expect(parseDuration("1d")).toBe(86400000);
});

test("parseDuration: invalid format throws", () => {
  expect(() => parseDuration("abc")).toThrow(/unsupported duration format/);
});
