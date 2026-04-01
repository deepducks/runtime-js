"use client";

import { Table, Typography } from "antd";
import { useRouter } from "next/navigation";
import { useExecutions } from "../hooks/useExecutions.ts";
import StatusBadge from "./StatusBadge.tsx";
import type { ExecutionTrace } from "@duckflux/core";

interface ExecutionListProps {
  workflowId?: string;
}

export default function ExecutionList({ workflowId }: ExecutionListProps) {
  const { executions, isLoading } = useExecutions(workflowId);
  const router = useRouter();

  const columns = [
    {
      title: "ID",
      dataIndex: ["execution", "id"],
      key: "id",
      render: (id: string) => (
        <Typography.Text code style={{ fontSize: 12 }}>
          {id.slice(0, 8)}…
        </Typography.Text>
      ),
    },
    {
      title: "Status",
      dataIndex: ["execution", "status"],
      key: "status",
      render: (status: string) => (
        <StatusBadge status={status as "success" | "failure" | "running" | "skipped"} />
      ),
    },
    {
      title: "Started",
      dataIndex: ["execution", "startedAt"],
      key: "startedAt",
      render: (v: string) => new Date(v).toLocaleString(),
    },
    {
      title: "Duration",
      dataIndex: ["execution", "duration"],
      key: "duration",
      render: (v?: number) => (v !== undefined ? `${Math.round(v)}ms` : "—"),
    },
  ];

  return (
    <Table<ExecutionTrace>
      dataSource={executions}
      columns={columns}
      rowKey={(r) => r.execution.id}
      loading={isLoading}
      size="small"
      onRow={(record) => ({
        onClick: () => {
          const wid = record.execution.workflowId ?? workflowId ?? "unknown";
          router.push(`/workflows/${encodeURIComponent(wid)}/executions/${record.execution.id}`);
        },
        style: { cursor: "pointer" },
      })}
      pagination={{ pageSize: 20, hideOnSinglePage: true }}
    />
  );
}
