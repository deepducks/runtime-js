"use client";

import { Tag, Spin } from "antd";
import { LoadingOutlined } from "@ant-design/icons";

interface StatusBadgeProps {
  status: "success" | "failure" | "running" | "skipped";
}

const STATUS_CONFIG = {
  success: { color: "success", label: "success" },
  failure: { color: "error", label: "failure" },
  running: { color: "processing", label: "running" },
  skipped: { color: "default", label: "skipped" },
} as const;

export default function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.skipped;
  return (
    <Tag color={config.color} icon={status === "running" ? <Spin size="small" indicator={<LoadingOutlined spin />} /> : undefined}>
      {config.label}
    </Tag>
  );
}
