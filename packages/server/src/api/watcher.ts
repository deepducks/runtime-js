import chokidar from "chokidar";
import { basename } from "node:path";
import type { SSEBroadcaster } from "./services/sse-broadcaster.ts";

export function startTraceWatcher(traceDir: string, broadcaster: SSEBroadcaster): () => Promise<void> {
  const watcher = chokidar.watch(`${traceDir}/*.json`, {
    persistent: true,
    ignoreInitial: true,
  });

  const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

  watcher.on("add", (filePath) => {
    const executionId = basename(filePath, ".json");
    broadcaster.broadcast({ type: "trace:new", executionId });
  });

  watcher.on("change", (filePath) => {
    const executionId = basename(filePath, ".json");
    const existing = debounceTimers.get(executionId);
    if (existing) clearTimeout(existing);
    debounceTimers.set(
      executionId,
      setTimeout(() => {
        broadcaster.broadcast({ type: "trace:updated", executionId });
        debounceTimers.delete(executionId);
      }, 200)
    );
  });

  return async () => {
    for (const t of debounceTimers.values()) clearTimeout(t);
    debounceTimers.clear();
    await watcher.close();
  };
}
