"use client";

import { useState } from "react";
import { Menu, Button, Spin, Alert } from "antd";
import { PlayCircleOutlined } from "@ant-design/icons";
import { useRouter, usePathname } from "next/navigation";
import { useWorkflows } from "../hooks/useWorkflows.ts";
import ExecuteModal from "./ExecuteModal.tsx";
import type { WorkflowMeta } from "../api/services/workflow-scanner.ts";

export default function WorkflowTree() {
  const { workflows, isLoading, error } = useWorkflows();
  const router = useRouter();
  const pathname = usePathname();
  const [runningWorkflow, setRunningWorkflow] = useState<WorkflowMeta | null>(null);

  if (isLoading) return <Spin style={{ margin: 16 }} />;
  if (error) return <Alert type="error" message="Failed to load workflows" style={{ margin: 8 }} />;

  const selectedKey = pathname.match(/\/workflows\/([^/]+)/)?.[1] ?? "";

  const items = workflows.map((w) => ({
    key: encodeURIComponent(w.id),
    label: (
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {w.name ?? w.relativePath}
        </span>
        <Button
          type="text"
          size="small"
          icon={<PlayCircleOutlined />}
          onClick={(e) => {
            e.stopPropagation();
            setRunningWorkflow(w);
          }}
          title="Run workflow"
        />
      </div>
    ),
  }));

  return (
    <>
      <Menu
        mode="inline"
        selectedKeys={[selectedKey]}
        items={items}
        onClick={({ key }) => router.push(`/workflows/${key}`)}
        style={{ border: "none", height: "100%", overflowY: "auto" }}
      />
      {runningWorkflow && (
        <ExecuteModal
          workflow={runningWorkflow}
          onClose={() => setRunningWorkflow(null)}
        />
      )}
    </>
  );
}
