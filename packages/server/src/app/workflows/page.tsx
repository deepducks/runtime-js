"use client";

import AppLayout from "../../components/AppLayout";
import { Typography } from "antd";

export default function WorkflowsPage() {
  return (
    <AppLayout>
      <Typography.Text type="secondary">
        Select a workflow from the sidebar to view executions.
      </Typography.Text>
    </AppLayout>
  );
}
