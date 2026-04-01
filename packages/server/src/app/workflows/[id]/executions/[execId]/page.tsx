"use client";

import { use } from "react";
import AppLayout from "../../../../../components/AppLayout";
import TraceViewer from "../../../../../components/TraceViewer";

export default function ExecutionPage({
  params,
}: {
  params: Promise<{ id: string; execId: string }>;
}) {
  const { execId } = use(params);

  return (
    <AppLayout>
      <TraceViewer executionId={execId} />
    </AppLayout>
  );
}
