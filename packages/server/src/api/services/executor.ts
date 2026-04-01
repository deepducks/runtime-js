import { spawn } from "node:child_process";
import { resolve } from "node:path";

export interface ExecuteRequest {
  filePath: string;
  inputs?: Record<string, unknown>;
  traceDir: string;
}

// Inline script that imports @duckflux/core/engine and runs a workflow.
// Bun resolves the "bun" export condition natively, so this works.
function buildRunnerScript(req: ExecuteRequest): string {
  const escaped = (s: string) => s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  return `
    import { runWorkflowFromFile } from '@duckflux/core/engine';
    await runWorkflowFromFile('${escaped(req.filePath)}', ${JSON.stringify(req.inputs ?? {})}, {
      traceDir: '${escaped(req.traceDir)}',
      traceFormat: 'json',
    });
  `;
}

export function executeWorkflowAsync(req: ExecuteRequest): void {
  // Fire-and-forget: spawn a bun subprocess to run the workflow.
  // The trace file written to traceDir is the source of truth.
  // The chokidar watcher detects the new file and broadcasts via SSE.
  const script = buildRunnerScript(req);
  const cwd = resolve(process.cwd());

  const child = spawn("bun", ["--eval", script], {
    cwd,
    stdio: "pipe",
    env: process.env,
  });

  child.stderr?.on("data", (data) => {
    console.error("[executor]", data.toString().trim());
  });

  child.on("error", (err) => {
    console.error("[executor] spawn failed:", err.message);
  });
}
