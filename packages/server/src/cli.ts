import { parseArgs } from "node:util";
import { resolve, dirname, join } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { mkdirSync, existsSync } from "node:fs";

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    port: { type: "string", default: "3000" },
    "trace-dir": { type: "string" },
    "workflow-dir": { type: "string" },
    dev: { type: "boolean", default: false },
  },
  allowPositionals: false,
});

const port = parseInt(values["port"] ?? "3000", 10);
const isDev = values["dev"] ?? false;

if (!values["trace-dir"]) {
  console.error("Error: --trace-dir is required");
  process.exit(1);
}

const traceDir = resolve(values["trace-dir"]);
const workflowDir = resolve(values["workflow-dir"] ?? process.cwd());

// Ensure trace dir exists
mkdirSync(traceDir, { recursive: true });

// Set env vars for Next.js process (API routes read these)
process.env.DUCKFLUX_TRACE_DIR = traceDir;
process.env.DUCKFLUX_WORKFLOW_DIR = workflowDir;
process.env.PORT = String(port);

// Locate the Next.js binary by resolving the next package and finding its bin
function resolveNextBin(): string {
  try {
    const nextPkg = import.meta.resolve("next/package.json");
    const nextPkgDir = dirname(fileURLToPath(nextPkg));
    return join(nextPkgDir, "dist", "bin", "next");
  } catch {
    // Fallback: walk up from this file looking for node_modules/.bin/next
    let dir = dirname(fileURLToPath(import.meta.url));
    for (let i = 0; i < 6; i++) {
      const candidate = join(dir, "node_modules", ".bin", "next");
      if (existsSync(candidate)) return candidate;
      dir = dirname(dir);
    }
    throw new Error("Could not locate Next.js binary. Is next installed?");
  }
}
const nextBin = resolveNextBin();

// The Next.js app root is the packages/server directory (contains next.config.ts)
const nextAppDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

console.log(`  duckflux server  →  http://localhost:${port}`);
console.log(`  trace-dir        →  ${traceDir}`);
console.log(`  workflow-dir     →  ${workflowDir}`);

// Spawn Next.js (single process — API routes run inside Next.js)
const nextProcess = spawn(nextBin, [isDev ? "dev" : "start", "--port", String(port)], {
  cwd: nextAppDir,
  stdio: "inherit",
  env: process.env,
});

nextProcess.on("error", (err) => {
  console.error("Failed to start Next.js:", err.message);
  process.exit(1);
});

nextProcess.on("exit", (code) => {
  process.exit(code ?? 0);
});

function shutdown() {
  nextProcess.kill("SIGTERM");
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
