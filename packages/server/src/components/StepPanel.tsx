"use client";

import { memo } from "react";
import { Collapse, Space, Tag, Alert, Typography, Flex } from "antd";
import type { StepTrace } from "@duckflux/core";
import StatusBadge from "./StatusBadge.tsx";
import JsonViewer from "./JsonViewer.tsx";

interface StepPanelProps {
  step: StepTrace;
}

function StepPanelInner({ step }: StepPanelProps) {
  const status = step.status as "success" | "failure" | "skipped";

  const header = (
    <Flex gap={8} align="center" wrap="wrap">
      <Typography.Text strong>{step.name}</Typography.Text>
      <Tag>{step.type}</Tag>
      <StatusBadge status={status} />
      {step.duration !== undefined && (
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {Math.round(step.duration)}ms
        </Typography.Text>
      )}
      {step.loopIndex !== undefined && (
        <Tag color="purple">loop #{step.loopIndex}</Tag>
      )}
      {step.retries !== undefined && step.retries > 0 && (
        <Tag color="orange">{step.retries} {step.retries === 1 ? "retry" : "retries"}</Tag>
      )}
    </Flex>
  );

  return (
    <Collapse
      size="small"
      items={[
        {
          key: "1",
          label: header,
          children: (
            <Space direction="vertical" style={{ width: "100%" }}>
              {step.error && <Alert type="error" message={step.error} showIcon />}
              <JsonViewer data={step.input} label="Input" />
              <JsonViewer data={step.output} label="Output" />
            </Space>
          ),
        },
      ]}
    />
  );
}

export default memo(StepPanelInner);
