"use client";

import { useState } from "react";
import { Modal, Form, Input, InputNumber, Switch, Select, Button, Typography, message } from "antd";
import type { WorkflowMeta } from "../api/services/workflow-scanner.ts";

interface ExecuteModalProps {
  workflow: WorkflowMeta;
  onClose: () => void;
}

export default function ExecuteModal({ workflow, onClose }: ExecuteModalProps) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const inputDefs = Object.entries(workflow.inputs ?? {});

  async function handleSubmit() {
    const values = await form.validateFields();
    setLoading(true);
    try {
      const res = await fetch("/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filePath: workflow.filePath, inputs: values }),
      });
      if (!res.ok) throw new Error("Execution request failed");
      message.success("Workflow execution started");
      onClose();
    } catch {
      message.error("Failed to start workflow");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open
      title={`Run: ${workflow.name ?? workflow.relativePath}`}
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose}>Cancel</Button>,
        <Button key="run" type="primary" loading={loading} onClick={handleSubmit}>Run</Button>,
      ]}
    >
      <Form form={form} layout="vertical">
        {inputDefs.length === 0 && (
          <Form.Item>
            <Typography.Text type="secondary">This workflow has no inputs.</Typography.Text>
          </Form.Item>
        )}
        {inputDefs.map(([name, def]) => {
          const required = def?.required ?? false;
          const label = name + (def?.description ? ` — ${def.description}` : "");

          let control: React.ReactNode;
          if (def?.type === "boolean") {
            control = <Switch />;
          } else if (def?.type === "integer" || def?.type === "number") {
            control = <InputNumber style={{ width: "100%" }} min={def.minimum} max={def.maximum} />;
          } else if (def?.enum) {
            control = (
              <Select options={def.enum.map((v) => ({ label: String(v), value: v }))} />
            );
          } else {
            control = <Input />;
          }

          return (
            <Form.Item
              key={name}
              name={name}
              label={label}
              initialValue={def?.default}
              valuePropName={def?.type === "boolean" ? "checked" : "value"}
              rules={required ? [{ required: true, message: `${name} is required` }] : []}
            >
              {control}
            </Form.Item>
          );
        })}
      </Form>
    </Modal>
  );
}
