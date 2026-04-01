"use client";

import { useEffect, useRef } from "react";
import type { SSEEvent } from "../api/services/sse-broadcaster.ts";

export type SSEEventCallback = (event: SSEEvent) => void;

export function useSSE(onEvent: SSEEventCallback): void {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    let es: EventSource | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    let retryDelay = 1000;
    let stopped = false;

    function connect() {
      if (stopped) return;
      es = new EventSource("/api/events");

      es.onmessage = (e) => {
        if (!e.data) return;
        try {
          const event = JSON.parse(e.data) as SSEEvent;
          onEventRef.current(event);
        } catch {
          // ignore malformed events
        }
      };

      es.onerror = () => {
        es?.close();
        es = null;
        if (!stopped) {
          reconnectTimeout = setTimeout(() => {
            retryDelay = Math.min(retryDelay * 2, 30_000);
            connect();
          }, retryDelay);
        }
      };

      es.addEventListener("open", () => {
        retryDelay = 1000;
      });
    }

    connect();

    return () => {
      stopped = true;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      es?.close();
    };
  }, []);
}
