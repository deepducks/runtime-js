"use client";

import { useState } from "react";
import { Typography, Space, Button, Spin, Alert } from "antd";
import { PlayCircleOutlined } from "@ant-design/icons";
import useSWR from "swr";
import type { WorkflowMeta } from "../api/services/workflow-scanner.ts";
import ExecuteModal from "./ExecuteModal.tsx";

interface WorkflowHeaderProps {
  workflowId: string;
}

async function fetcher(url: string) {
  const res = await fetch(url);
  if (!res.ok) return null;
  return res.json() as Promise<WorkflowMeta>;
}

export default function WorkflowHeader({ workflowId }: WorkflowHeaderProps) {
  const { data: workflow, isLoading, error } = useSWR<WorkflowMeta | null>(
    `/api/workflows/${encodeURIComponent(workflowId)}`,
    fetcher
  );
  const [showModal, setShowModal] = useState(false);

  if (isLoading) return <Spin />;
  if (error || !workflow) return <Alert type="error" message="Workflow not found" />;

  return (
    <>
      <Space align="center" style={{ marginBottom: 16 }}>
        <div>
          <Typography.Title level={4} style={{ margin: 0 }}>
            {workflow.name ?? workflow.relativePath}
          </Typography.Title>
          {workflow.version && (
            <Typography.Text type="secondary">v{workflow.version}</Typography.Text>
          )}
        </div>
        <Button
          type="primary"
          icon={<PlayCircleOutlined />}
          onClick={() => setShowModal(true)}
        >
          Run
        </Button>
      </Space>

      {showModal && (
        <ExecuteModal workflow={workflow} onClose={() => setShowModal(false)} />
      )}
    </>
  );
}
