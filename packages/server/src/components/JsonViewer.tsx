"use client";

import { useState, useMemo, memo } from "react";
import { Collapse, Button, Typography } from "antd";

const TRUNCATE_BYTES = 10_000;

interface JsonViewerProps {
  data: unknown;
  label?: string;
  defaultOpen?: boolean;
}

function JsonViewerInner({ data, label = "JSON", defaultOpen = false }: JsonViewerProps) {
  const [showFull, setShowFull] = useState(false);

  const full = useMemo(
    () => (data !== undefined && data !== null ? JSON.stringify(data, null, 2) : null),
    [data]
  );

  if (!full) return null;

  const truncated = full.length > TRUNCATE_BYTES && !showFull;
  const content = truncated ? full.slice(0, TRUNCATE_BYTES) + "\n…" : full;

  return (
    <Collapse
      size="small"
      defaultActiveKey={defaultOpen ? ["1"] : []}
      expandIcon={({ isActive }) => (
        <span style={{ transform: isActive ? "rotate(90deg)" : "none", display: "inline-block", transition: "transform 0.15s" }}>▸</span>
      )}
      items={[
        {
          key: "1",
          label,
          children: (
            <div>
              <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 12, maxHeight: 400, overflow: "auto" }}>
                <Typography.Text code>{content}</Typography.Text>
              </pre>
              {full.length > TRUNCATE_BYTES && (
                <Button
                  type="link"
                  size="small"
                  onClick={() => setShowFull((v) => !v)}
                  style={{ padding: 0, marginTop: 4 }}
                >
                  {showFull ? "Show less" : `Show full (${full.length.toLocaleString()} chars)`}
                </Button>
              )}
            </div>
          ),
        },
      ]}
    />
  );
}

export default memo(JsonViewerInner);
