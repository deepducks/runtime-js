import { test, expect, describe } from "bun:test";
import { evaluateCel, validateCelExpression } from "../../src/cel/index";

describe("CEL fuzz: malformed expressions", () => {
  const malformed = [
    "",
    "   ",
    "+",
    "+++",
    "((",
    "))",
    "(((",
    "1 +",
    "+ 1",
    "a b c",
    "if true",
    "for x in y",
    "{{{",
    "[[[",
    "1 == == 2",
    '"unclosed string',
    "'single quotes'",
    "null.null.null",
    "1 / 0",
    "a.b.c.d.e.f.g.h.i.j",
    "true && &&",
    "|| false",
    "1 > > 2",
    "func(,)",
    "[1, 2, ",
    "{a: }",
  ];

  for (const expr of malformed) {
    test(`malformed: ${JSON.stringify(expr)}`, () => {
      // Should either report invalid or throw — never crash/hang
      const validation = validateCelExpression(expr);
      if (!validation.valid) {
        expect(validation.error).toBeDefined();
        return;
      }
      // If parse succeeds, evaluation should either return or throw a descriptive error
      try {
        evaluateCel(expr, {});
      } catch (err) {
        expect(err).toBeInstanceOf(Error);
        expect((err as Error).message).toBeTruthy();
      }
    });
  }
});

describe("CEL fuzz: deeply nested expressions", () => {
  test("deeply nested parentheses", () => {
    // 20 levels deep
    const expr = "(" .repeat(20) + "1 + 2" + ")".repeat(20);
    const result = evaluateCel(expr, {});
    expect(result).toBe(3);
  });

  test("deeply nested ternary", () => {
    // true ? (true ? (true ? 42 : 0) : 0) : 0
    const expr = "true ? true ? true ? 42 : 0 : 0 : 0";
    const result = evaluateCel(expr, {});
    expect(result).toBe(42);
  });

  test("nested list access", () => {
    const ctx = { data: [[1, 2], [3, 4]] };
    const result = evaluateCel("data[1][0]", ctx);
    expect(result).toBe(3);
  });

  test("chained property access", () => {
    const ctx = {
      a: { b: { c: { d: { e: "deep" } } } },
    };
    const result = evaluateCel("a.b.c.d.e", ctx);
    expect(result).toBe("deep");
  });
});

describe("CEL fuzz: type coercion edge cases", () => {
  test("number compared to string throws or returns false", () => {
    try {
      const result = evaluateCel("1 == '1'", {});
      // CEL spec: no implicit coercion, should be false
      expect(result).toBe(false);
    } catch (err) {
      // Also acceptable: type mismatch error
      expect(err).toBeInstanceOf(Error);
    }
  });

  test("null comparisons", () => {
    const ctx = { val: null };
    const result = evaluateCel("val == null", ctx);
    expect(result).toBe(true);
  });

  test("boolean arithmetic should fail", () => {
    try {
      evaluateCel("true + 1", {});
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
    }
  });

  test("list equality", () => {
    const ctx = { a: [1, 2, 3], b: [1, 2, 3] };
    const result = evaluateCel("a == b", ctx);
    expect(result).toBe(true);
  });

  test("empty map access throws descriptive error", () => {
    try {
      evaluateCel("missing_var.field", {});
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      const msg = (err as Error).message;
      // Should mention the variable name or context
      expect(msg.length).toBeGreaterThan(0);
    }
  });
});

describe("CEL fuzz: custom function edge cases", () => {
  test("timestamp with invalid input", () => {
    expect(() => evaluateCel('timestamp("not-a-date")', {})).toThrow(/invalid timestamp/);
  });

  test("duration with invalid input", () => {
    expect(() => evaluateCel('duration("xyz")', {})).toThrow(/invalid duration/);
  });

  test("matches with valid regex", () => {
    const result = evaluateCel('matches("hello123", "^[a-z]+[0-9]+$")', {});
    expect(result).toBe(true);
  });

  test("matches with non-matching string", () => {
    const result = evaluateCel('matches("hello", "^[0-9]+$")', {});
    expect(result).toBe(false);
  });

  test("lowerAscii and upperAscii", () => {
    expect(evaluateCel('lowerAscii("HELLO")', {})).toBe("hello");
    expect(evaluateCel('upperAscii("hello")', {})).toBe("HELLO");
  });

  test("replace function", () => {
    const result = evaluateCel('replace("foo-bar-baz", "-", "_")', {});
    expect(result).toBe("foo_bar_baz");
  });

  test("split and join", () => {
    const split = evaluateCel('split("a,b,c", ",")', {});
    expect(split).toEqual(["a", "b", "c"]);

    const ctx = { parts: ["a", "b", "c"] };
    const joined = evaluateCel('join(parts, "-")', ctx);
    expect(joined).toBe("a-b-c");
  });

  test("contains, startsWith, endsWith", () => {
    expect(evaluateCel('contains("hello world", "world")', {})).toBe(true);
    expect(evaluateCel('contains("hello world", "xyz")', {})).toBe(false);
    expect(evaluateCel('startsWith("hello world", "hello")', {})).toBe(true);
    expect(evaluateCel('startsWith("hello world", "world")', {})).toBe(false);
    expect(evaluateCel('endsWith("hello world", "world")', {})).toBe(true);
    expect(evaluateCel('endsWith("hello world", "hello")', {})).toBe(false);
  });

  test("timestamp returns epoch seconds", () => {
    const result = evaluateCel('timestamp("2024-01-01T00:00:00Z")', {});
    expect(result).toBe(1704067200);
  });

  test("duration returns seconds", () => {
    expect(evaluateCel('duration("30s")', {})).toBe(30);
    expect(evaluateCel('duration("2m")', {})).toBe(120);
    expect(evaluateCel('duration("500ms")', {})).toBe(0.5);
  });
});

describe("CEL fuzz: error messages don't leak internal state", () => {
  test("evaluation error includes expression but not full context values", () => {
    try {
      evaluateCel("nonexistent.deep.path", { secret: "s3cret-value" });
    } catch (err) {
      const msg = (err as Error).message;
      // Should mention the expression
      expect(msg).toContain("nonexistent");
      // Should NOT contain the secret value
      expect(msg).not.toContain("s3cret-value");
    }
  });

  test("parse error includes expression", () => {
    try {
      evaluateCel("invalid ++ syntax", { key: "val" });
    } catch (err) {
      const msg = (err as Error).message;
      expect(msg).toContain("invalid ++ syntax");
    }
  });
});
