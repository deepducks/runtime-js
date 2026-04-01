import { existsSync } from "node:fs";
import { join } from "node:path";
import { spawn, execSync } from "node:child_process";
import { createInterface } from "node:readline";

async function ensureServerPackage(cwd: string): Promise<boolean> {
  const serverBin = join(cwd, "node_modules", ".bin", "duckflux-server");
  const serverPkg = join(cwd, "node_modules", "@duckflux", "server");
  if (existsSync(serverBin) || existsSync(serverPkg)) return true;

  const rl = createInterface({ input: process.stdin, output: process.stderr });
  const answer = await new Promise<string>((resolve) => {
    rl.question(
      "\n@duckflux/server is not installed. Install it now? [Y/n] ",
      resolve
    );
  });
  rl.close();

  if (answer.trim().toLowerCase() === "n") {
    console.error("Cancelled. Run `bun add @duckflux/server -D` to install manually.");
    return false;
  }

  console.error("Installing @duckflux/server...");
  try {
    execSync("bun add @duckflux/server -D", { cwd, stdio: "inherit" });
    return true;
  } catch {
    try {
      execSync("npm install @duckflux/server --save-dev", { cwd, stdio: "inherit" });
      return true;
    } catch {
      console.error("Failed to install @duckflux/server. Please install it manually.");
      return false;
    }
  }
}

export default async function serverCommand(
  values: Record<string, unknown>
): Promise<number> {
  const cwd = (values["cwd"] as string | undefined) ?? process.cwd();
  const installed = await ensureServerPackage(cwd);
  if (!installed) return 1;

  const args: string[] = [];
  if (values["trace-dir"]) args.push("--trace-dir", values["trace-dir"] as string);
  if (values["workflow-dir"]) args.push("--workflow-dir", values["workflow-dir"] as string);
  if (values["port"]) args.push("--port", values["port"] as string);

  const child = spawn("bunx", ["@duckflux/server", ...args], {
    cwd,
    stdio: "inherit",
    env: process.env,
  });

  return new Promise((resolve) => {
    child.on("error", (err) => {
      console.error("Failed to start duckflux server:", err.message);
      resolve(1);
    });
    child.on("exit", (code) => resolve(code ?? 0));
    process.on("SIGINT", () => child.kill("SIGINT"));
    process.on("SIGTERM", () => child.kill("SIGTERM"));
  });
}
