#!/usr/bin/env bun
import { readFile } from "node:fs/promises";
import { runWorkflowFromFile } from "../engine/engine";
import type { ExecuteOptions } from "../engine/engine";

type CLIValues = Record<string, unknown> | undefined;

function parseInputFlags(arr: string[] | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!arr) return out;
  for (const item of arr) {
    const idx = item.indexOf("=");
    if (idx === -1) {
      out[item] = true;
    } else {
      const k = item.slice(0, idx);
      const v = item.slice(idx + 1);
      try {
        out[k] = JSON.parse(v);
      } catch {
        out[k] = v;
      }
    }
  }
  return out;
}

export default async function runCommand(filePath?: string, cliValues?: CLIValues): Promise<number> {
  if (!filePath) {
    console.error("Usage: duckflux run <workflow.yaml> [--input k=v] [--input-file file.json] [--cwd dir]");
    return 1;
  }

  // Input precedence: --input > --input-file > stdin
  let inputs: Record<string, unknown> = {};

  // 1. Try stdin first (lowest priority)
  try {
    if (process.stdin && !process.stdin.isTTY) {
      let stdin = "";
      for await (const chunk of process.stdin) {
        stdin += chunk;
      }
      stdin = stdin.trim();
      if (stdin.length > 0) {
        try {
          const parsed = JSON.parse(stdin);
          if (typeof parsed === "object" && parsed !== null) inputs = { ...inputs, ...parsed };
        } catch {
          // ignore non-json stdin
        }
      }
    }
  } catch {
    // ignore
  }

  if (cliValues) {
    // 2. --input-file (overrides stdin)
    if (cliValues["input-file"]) {
      try {
        const content = await readFile(String(cliValues["input-file"]), "utf-8");
        const parsed = JSON.parse(content);
        if (typeof parsed === "object" && parsed !== null) inputs = { ...inputs, ...parsed };
      } catch (err) {
        console.error("Failed to read input file:", err);
        return 1;
      }
    }

    // 3. --input flags (highest priority)
    if (cliValues.input) {
      const parsed = Array.isArray(cliValues.input) ? cliValues.input : [cliValues.input];
      inputs = { ...inputs, ...parseInputFlags(parsed as string[]) };
    }
  }

  const options: ExecuteOptions = {
    cwd: cliValues?.cwd as string | undefined,
    verbose: cliValues?.verbose as boolean | undefined,
    quiet: cliValues?.quiet as boolean | undefined,
  };

  try {
    const res = await runWorkflowFromFile(filePath, inputs, options);

    // Print resolved output, not full WorkflowResult
    const output = res.output;
    if (output === undefined || output === null) {
      // No output
    } else if (typeof output === "string") {
      process.stdout.write(output);
    } else {
      console.log(JSON.stringify(output, null, 2));
    }

    return res.success ? 0 : 2;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Error:", msg);
    if (cliValues?.verbose && err instanceof Error && err.stack) {
      console.error(err.stack);
    }
    return 1;
  }
}

export { parseInputFlags };
