"use client";

import { Card, Space, Typography, Flex, Divider, Spin, Alert } from "antd";
import { useExecution } from "../hooks/useExecutions.ts";
import StatusBadge from "./StatusBadge.tsx";
import StepPanel from "./StepPanel.tsx";
import JsonViewer from "./JsonViewer.tsx";

interface TraceViewerProps {
  executionId: string;
}

export default function TraceViewer({ executionId }: TraceViewerProps) {
  const { trace, isLoading, error } = useExecution(executionId);

  if (isLoading) return <Spin />;
  if (error) return <Alert type="error" message="Failed to load execution" />;
  if (!trace) return null;

  const { execution, steps } = trace;
  const status = execution.status as "success" | "failure" | "running" | "skipped";

  return (
    <Space direction="vertical" style={{ width: "100%" }} size="middle">
      <Card size="small">
        <Space direction="vertical" style={{ width: "100%" }}>
          <Flex gap={12} align="center" wrap="wrap">
            <Typography.Title level={5} style={{ margin: 0 }}>
              {execution.workflowName ?? execution.workflowId ?? "Workflow"}
            </Typography.Title>
            <StatusBadge status={status} />
            {execution.duration != null && (
              <Typography.Text type="secondary">{Math.round(execution.duration)}ms</Typography.Text>
            )}
          </Flex>
          <Typography.Text type="secondary" copyable style={{ fontSize: 12 }}>
            {execution.id}
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Started: {new Date(execution.startedAt).toLocaleString()}
          </Typography.Text>
          <Divider style={{ margin: "8px 0" }} />
          <JsonViewer data={execution.inputs} label="Inputs" />
          <JsonViewer data={execution.output} label="Output" />
        </Space>
      </Card>

      <Space direction="vertical" style={{ width: "100%" }}>
        {steps.map((step) => (
          <StepPanel key={step.seq} step={step} />
        ))}
      </Space>
    </Space>
  );
}
