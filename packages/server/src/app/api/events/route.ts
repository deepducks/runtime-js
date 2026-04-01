import { getBroadcaster } from "../../../api/services/singleton.ts";
import type { SSEEvent } from "../../../api/services/sse-broadcaster.ts";

const KEEPALIVE_INTERVAL_MS = 15_000;

export const dynamic = "force-dynamic";

export async function GET() {
  const broadcaster = getBroadcaster();

  let unsub: (() => void) | null = null;
  let keepAlive: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      function send(event: string, data: string) {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${data}\n\n`));
        } catch {
          // Controller closed, cleanup will happen in cancel
        }
      }

      unsub = broadcaster.subscribe((raw) => {
        const evt = JSON.parse(raw) as SSEEvent;
        send("message", JSON.stringify(evt));
      });

      keepAlive = setInterval(() => {
        send("ping", "");
      }, KEEPALIVE_INTERVAL_MS);
    },
    cancel() {
      unsub?.();
      if (keepAlive) clearInterval(keepAlive);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
