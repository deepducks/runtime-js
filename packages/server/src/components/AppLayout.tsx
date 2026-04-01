"use client";

import { Layout, Typography, Button, theme } from "antd";
import { SunOutlined, MoonOutlined } from "@ant-design/icons";
import WorkflowTree from "./WorkflowTree.tsx";
import ThemeProvider, { useThemeMode } from "./ThemeProvider.tsx";

const { Sider, Content, Header } = Layout;

interface AppLayoutProps {
  children: React.ReactNode;
}

function AppLayoutInner({ children }: AppLayoutProps) {
  const { mode, toggle } = useThemeMode();
  const { token } = theme.useToken();

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider
        width={260}
        theme={mode === "dark" ? "dark" : "light"}
        style={{
          borderRight: `1px solid ${token.colorBorder}`,
          overflow: "auto",
        }}
      >
        <div
          style={{
            padding: "16px 16px 8px",
            borderBottom: `1px solid ${token.colorBorder}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <div>
            <Typography.Text strong style={{ fontSize: 16 }}>
              🦆 duckflux
            </Typography.Text>
            <Typography.Text type="secondary" style={{ display: "block", fontSize: 12 }}>
              server
            </Typography.Text>
          </div>
          <Button
            type="text"
            size="small"
            icon={mode === "dark" ? <SunOutlined /> : <MoonOutlined />}
            onClick={toggle}
            title={`Switch to ${mode === "dark" ? "light" : "dark"} mode`}
            style={{ marginTop: 2 }}
          />
        </div>
        <WorkflowTree />
      </Sider>
      <Layout>
        <Header
          style={{
            borderBottom: `1px solid ${token.colorBorder}`,
            padding: "0 24px",
            lineHeight: "48px",
            height: 48,
          }}
        >
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Workflows
          </Typography.Text>
        </Header>
        <Content style={{ padding: 24, overflowY: "auto" }}>{children}</Content>
      </Layout>
    </Layout>
  );
}

export default function AppLayout({ children }: AppLayoutProps) {
  return (
    <ThemeProvider>
      <AppLayoutInner>{children}</AppLayoutInner>
    </ThemeProvider>
  );
}
