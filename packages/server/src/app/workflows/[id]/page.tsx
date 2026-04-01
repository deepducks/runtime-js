"use client";

import { use } from "react";
import AppLayout from "../../../components/AppLayout";
import ExecutionList from "../../../components/ExecutionList";
import WorkflowHeader from "../../../components/WorkflowHeader";

export default function WorkflowPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const workflowId = decodeURIComponent(id);

  return (
    <AppLayout>
      <WorkflowHeader workflowId={workflowId} />
      <ExecutionList workflowId={workflowId} />
    </AppLayout>
  );
}
