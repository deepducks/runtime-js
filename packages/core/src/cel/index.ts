import { evaluate, parse } from "cel-js";

// Expression cache: parsed AST reuse
const expressionCache = new Map<string, ReturnType<typeof parse>>();

function getParsed(expr: string): ReturnType<typeof parse> {
  let cached = expressionCache.get(expr);
  if (!cached) {
    cached = parse(expr);
    expressionCache.set(expr, cached);
  }
  return cached;
}

export function validateCelExpression(expr: string): { valid: boolean; error?: string } {
  const parsed = getParsed(expr);
  if (parsed.isSuccess) {
    return { valid: true };
  }

  return {
    valid: false,
    error: parsed.errors.join("; "),
  };
}

// Custom functions registered as cel-js macros (third parameter to evaluate).
// These are available as function-style calls in CEL expressions: e.g. timestamp("..."), matches("...", "...").
const customFunctions: Record<string, CallableFunction> = {
  // Timestamp: converts ISO string to epoch seconds
  timestamp: (s: string) => {
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) throw new Error(`invalid timestamp: ${s}`);
    return Math.floor(d.getTime() / 1000);
  },
  // Duration: converts duration string to seconds
  duration: (s: string) => {
    const match = s.match(/^(\d+)(ms|s|m|h|d)$/);
    if (!match) throw new Error(`invalid duration: ${s}`);
    const val = Number(match[1]);
    switch (match[2]) {
      case "ms": return val / 1000;
      case "s": return val;
      case "m": return val * 60;
      case "h": return val * 3600;
      case "d": return val * 86400;
      default: throw new Error(`invalid duration unit: ${match[2]}`);
    }
  },
  // CEL standard library — string functions (§11.1)
  matches: (s: string, pattern: string) => new RegExp(pattern).test(s),
  lowerAscii: (s: string) => String(s).toLowerCase(),
  upperAscii: (s: string) => String(s).toUpperCase(),
  replace: (s: string, old: string, replacement: string) =>
    String(s).split(old).join(replacement),
  split: (s: string, sep: string) => String(s).split(sep),
  join: (list: unknown[], sep: string) => list.join(sep ?? ","),
  contains: (s: string, substr: string) => String(s).includes(substr),
  startsWith: (s: string, prefix: string) => String(s).startsWith(prefix),
  endsWith: (s: string, suffix: string) => String(s).endsWith(suffix),
};

// Names of custom functions (for filtering in error messages)
const CUSTOM_FUNCTION_NAMES = new Set(Object.keys(customFunctions));

export function evaluateCel(expr: unknown, context: Record<string, unknown>): unknown {
  if (typeof expr !== "string") {
    return expr;
  }

  const parsed = getParsed(expr);
  if (!parsed.isSuccess) {
    const contextKeys = Object.keys(context).filter((k) => !CUSTOM_FUNCTION_NAMES.has(k));
    throw new Error(
      `CEL parse error in expression '${expr}': ${parsed.errors.join("; ")}. Available context keys: [${contextKeys.join(", ")}]`,
    );
  }

  try {
    return evaluate(parsed.cst, context, customFunctions);
  } catch (err) {
    const contextKeys = Object.keys(context).filter((k) => !CUSTOM_FUNCTION_NAMES.has(k));
    // Strip context values from cel-js error messages to avoid leaking sensitive data
    const rawMessage = (err as Error).message;
    const sanitized = rawMessage.replace(/in context: \{[^}]*\}/g, "in context: {…}");
    throw new Error(
      `CEL evaluation error in '${expr}': ${sanitized}. Available context keys: [${contextKeys.join(", ")}]`,
    );
  }
}

export function evaluateCelStrict(expr: string, context: Record<string, unknown>): boolean {
  const result = evaluateCel(expr, context);
  if (typeof result !== "boolean") {
    throw new Error(`CEL expression must evaluate to boolean, got ${typeof result}: ${expr}`);
  }
  return result;
}

/**
 * Tries to evaluate a value as CEL. If the value is a string and CEL parsing
 * fails, returns the literal string. For objects/arrays, recurses into values.
 * Non-string scalars are returned as-is.
 */
export function evalMaybeCel(value: unknown, ctx: Record<string, unknown>): unknown {
  if (typeof value === "string") {
    try {
      return evaluateCel(value, ctx);
    } catch {
      return value;
    }
  }

  if (Array.isArray(value)) {
    return value.map((item) => evalMaybeCel(item, ctx));
  }

  if (value !== null && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      result[k] = evalMaybeCel(v, ctx);
    }
    return result;
  }

  return value;
}

export function buildCelContext(state: {
  toCelContext?: () => Record<string, unknown>;
  getAllResults?: () => Record<string, { output?: unknown; parsedOutput?: unknown; status: string }>;
  inputs?: Record<string, unknown>;
  currentLoopIndex?: () => number;
}): Record<string, unknown> {
  if (typeof state.toCelContext === "function") {
    return state.toCelContext();
  }

  const ctx: Record<string, unknown> = {};

  const results = state.getAllResults ? state.getAllResults() : {};
  for (const [name, result] of Object.entries(results)) {
    ctx[name] = {
      output: result.parsedOutput ?? result.output,
      status: result.status,
    };
  }

  ctx.input = state.inputs ?? {};
  ctx.env = { ...process.env };
  ctx.loop = {
    index: state.currentLoopIndex ? state.currentLoopIndex() : 0,
  };

  return ctx;
}
