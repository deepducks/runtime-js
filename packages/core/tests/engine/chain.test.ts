import { test, expect } from "bun:test";
import { mergeChainedInput } from "../../src/engine/sequential";

test("mergeChainedInput: both maps merge with explicit winning", () => {
  const chain = { a: 1, b: 2 };
  const explicit = { b: 3, c: 4 };
  const result = mergeChainedInput(chain, explicit) as Record<string, number>;
  expect(result).toEqual({ a: 1, b: 3, c: 4 });
});

test("mergeChainedInput: both strings, explicit wins", () => {
  const result = mergeChainedInput("chain", "explicit");
  expect(result).toBe("explicit");
});

test("mergeChainedInput: chain undefined, explicit used", () => {
  const result = mergeChainedInput(undefined, { x: 1 });
  expect(result).toEqual({ x: 1 });
});

test("mergeChainedInput: explicit undefined, chain used", () => {
  const result = mergeChainedInput({ x: 1 }, undefined);
  expect(result).toEqual({ x: 1 });
});

test("mergeChainedInput: both undefined", () => {
  const result = mergeChainedInput(undefined, undefined);
  expect(result).toBeUndefined();
});

test("mergeChainedInput: incompatible types throw (Spec §5.7)", () => {
  expect(() => mergeChainedInput({ a: 1 }, "string")).toThrow("I/O chain type conflict");
  expect(() => mergeChainedInput("string", { a: 1 })).toThrow("I/O chain type conflict");
});
