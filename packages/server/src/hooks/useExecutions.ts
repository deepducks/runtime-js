"use client";

import useSWR from "swr";
import { useSSE } from "./useSSE.ts";
import type { ExecutionTrace } from "@duckflux/core";

async function fetcher(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch executions");
  return res.json() as Promise<ExecutionTrace[]>;
}

export function useExecutions(workflowId?: string) {
  const url = workflowId
    ? `/api/executions?workflowId=${encodeURIComponent(workflowId)}`
    : "/api/executions";

  const { data, error, mutate, isLoading } = useSWR<ExecutionTrace[]>(url, fetcher, {
    refreshInterval: 0,
  });

  useSSE((event) => {
    if (event.type === "trace:new" || event.type === "trace:updated" || event.type === "execution:finished") {
      mutate();
    }
  });

  return { executions: data ?? [], error, isLoading };
}

export function useExecution(executionId: string) {
  const url = `/api/executions/${executionId}`;

  const { data, error, mutate, isLoading } = useSWR<ExecutionTrace>(url, async (u: string) => {
    const res = await fetch(u);
    if (!res.ok) throw new Error("Execution not found");
    return res.json() as Promise<ExecutionTrace>;
  });

  useSSE((event) => {
    if (
      (event.type === "trace:updated" || event.type === "execution:finished") &&
      event.executionId === executionId
    ) {
      mutate();
    }
  });

  return { trace: data ?? null, error, isLoading };
}
