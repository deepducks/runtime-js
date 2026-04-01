import { SSEBroadcaster } from "./sse-broadcaster.ts";
import { startTraceWatcher } from "../watcher.ts";

let broadcaster: SSEBroadcaster | null = null;
let stopWatcher: (() => Promise<void>) | null = null;

function getTraceDir(): string {
  const dir = process.env.DUCKFLUX_TRACE_DIR;
  if (!dir) throw new Error("DUCKFLUX_TRACE_DIR env var is required");
  return dir;
}

export function getWorkflowDir(): string {
  return process.env.DUCKFLUX_WORKFLOW_DIR ?? process.cwd();
}

export function getTraceDirectory(): string {
  return getTraceDir();
}

export function getBroadcaster(): SSEBroadcaster {
  if (!broadcaster) {
    broadcaster = new SSEBroadcaster();
    stopWatcher = startTraceWatcher(getTraceDir(), broadcaster);
  }
  return broadcaster;
}

export async function shutdown(): Promise<void> {
  if (stopWatcher) {
    await stopWatcher();
    stopWatcher = null;
  }
  broadcaster = null;
}
