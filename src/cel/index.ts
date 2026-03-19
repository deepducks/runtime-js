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

export function evaluateCel(expr: unknown, context: Record<string, unknown>): unknown {
  if (typeof expr !== "string") {
    return expr;
  }

  const parsed = getParsed(expr);
  if (!parsed.isSuccess) {
    throw new Error(parsed.errors.join("; "));
  }

  // Inject custom functions into context
  const enrichedContext: Record<string, unknown> = {
    ...context,
    // Custom timestamp function: converts ISO string to epoch seconds
    timestamp: (s: string) => {
      const d = new Date(s);
      if (Number.isNaN(d.getTime())) throw new Error(`invalid timestamp: ${s}`);
      return Math.floor(d.getTime() / 1000);
    },
    // Custom duration function: converts duration string to seconds
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
  };

  return evaluate(parsed.cst, enrichedContext);
}

export function evaluateCelStrict(expr: string, context: Record<string, unknown>): boolean {
  const result = evaluateCel(expr, context);
  if (typeof result !== "boolean") {
    throw new Error(`CEL expression must evaluate to boolean, got ${typeof result}: ${expr}`);
  }
  return result;
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
