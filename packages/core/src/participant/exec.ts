import { spawn } from "node:child_process";
import type { StepResult } from "../model/index";

function isMap(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mapToEnvVars(input: Record<string, unknown>): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(input)) {
    env[key] = typeof value === "string" ? value : String(value);
  }
  return env;
}

export async function executeExec(
  participant: { run?: string; env?: Record<string, string>; cwd?: string },
  input?: unknown,
  env: Record<string, string> = {},
  signal?: AbortSignal,
): Promise<StepResult> {
  const command = participant.run ?? "";
  const participantEnv = participant.env ?? {};
  const cwd = participant.cwd ?? process.cwd();

  // Spec v0.6: map input → env vars, string input → stdin, no input → nothing
  const inputEnvVars = isMap(input) ? mapToEnvVars(input) : {};
  const stdinData = typeof input === "string" ? input : undefined;

  const startedAt = new Date().toISOString();
  const start = Date.now();

  return new Promise<StepResult>((resolve) => {
    try {
      const proc = spawn("sh", ["-c", command], {
        env: { ...process.env, ...env, ...participantEnv, ...inputEnvVars },
        cwd,
        stdio: ["pipe", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";

      proc.stdout.on("data", (d: Buffer) => {
        stdout += d.toString();
      });
      proc.stderr.on("data", (d: Buffer) => {
        stderr += d.toString();
      });

      let aborted = false;
      const onAbort = () => {
        aborted = true;
        try {
          proc.kill("SIGKILL");
        } catch (_) {}
      };

      if (signal) {
        if (signal.aborted) onAbort();
        else signal.addEventListener("abort", onAbort);
      }

      proc.on("error", (err) => {
        const duration = Date.now() - start;
        if (signal) signal.removeEventListener("abort", onAbort);
        resolve({
          status: "failure",
          output: "",
          parsedOutput: undefined,
          error: String(err),
          duration,
          startedAt,
          finishedAt: new Date().toISOString(),
          cwd,
        });
      });

      proc.on("close", (code) => {
        const duration = Date.now() - start;
        if (signal) signal.removeEventListener("abort", onAbort);

        if (aborted) {
          resolve({
            status: "failure",
            output: stdout,
            parsedOutput: undefined,
            error: "aborted",
            duration,
            startedAt,
            finishedAt: new Date().toISOString(),
            cwd,
          });
          return;
        }

        const exitCode = code ?? 1;
        if (exitCode !== 0) {
          const errMsg = stderr.trim() || `exit code ${exitCode}`;
          resolve({
            status: "failure",
            output: stdout,
            parsedOutput: undefined,
            error: errMsg,
            duration,
            startedAt,
            finishedAt: new Date().toISOString(),
            cwd,
          });
          return;
        }

        let parsed: unknown | undefined = undefined;
        try {
          parsed = JSON.parse(stdout);
        } catch (_) {
          // ignore parse errors
        }

        resolve({
          status: "success",
          output: stdout,
          parsedOutput: parsed,
          duration,
          startedAt,
          finishedAt: new Date().toISOString(),
          cwd,
        });
      });

      // Spec v0.6: only write to stdin when input is a string
      if (stdinData !== undefined) {
        try {
          proc.stdin.write(stdinData);
          proc.stdin.end();
        } catch (_) {
          // ignore
        }
      } else {
        try { proc.stdin.end(); } catch (_) { /* ignore */ }
      }
    } catch (err) {
      const duration = Date.now() - start;
      resolve({
        status: "failure",
        output: "",
        parsedOutput: undefined,
        error: String(err),
        duration,
        startedAt,
        finishedAt: new Date().toISOString(),
        cwd,
      });
    }
  });
}

export default executeExec;
