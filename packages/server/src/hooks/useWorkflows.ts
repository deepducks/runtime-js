"use client";

import useSWR from "swr";
import { useSSE } from "./useSSE.ts";
import type { WorkflowMeta } from "../api/services/workflow-scanner.ts";

async function fetcher(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch workflows");
  return res.json() as Promise<WorkflowMeta[]>;
}

export function useWorkflows() {
  const { data, error, mutate, isLoading } = useSWR<WorkflowMeta[]>("/api/workflows", fetcher);

  useSSE((event) => {
    if (event.type === "trace:new") {
      mutate();
    }
  });

  return { workflows: data ?? [], error, isLoading };
}
