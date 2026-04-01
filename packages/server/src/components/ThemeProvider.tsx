"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { ConfigProvider, theme as antTheme } from "antd";
import type { ThemeConfig } from "antd";

type ThemeMode = "light" | "dark";

interface ThemeContextValue {
  mode: ThemeMode;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  mode: "dark",
  toggle: () => {},
});

export function useThemeMode() {
  return useContext(ThemeContext);
}

// Duckflux identity tokens from docs/src/styles/custom.css
const DUCKFLUX_GOLD = "#F5C518";
const DUCKFLUX_PURPLE = "#2d2d5e";

const darkTheme: ThemeConfig = {
  algorithm: antTheme.darkAlgorithm,
  token: {
    colorPrimary: DUCKFLUX_GOLD,
    colorBgContainer: "#131a2a",
    colorBgElevated: "#1a2236",
    colorBgLayout: "#0b0a15",
    colorBorder: "#384456",
    colorBorderSecondary: "#2a3344",
    colorText: "#e0e6ed",
    colorTextSecondary: "#b8c0cc",
    colorTextTertiary: "#6b7a8d",
    fontFamily: "'Outfit', system-ui, sans-serif",
    fontFamilyCode: "'JetBrains Mono', ui-monospace, monospace",
    borderRadius: 6,
    colorLink: DUCKFLUX_GOLD,
  },
  components: {
    Layout: {
      siderBg: "#0f0e20",
      headerBg: "#0f0e20",
      bodyBg: "#0b0a15",
    },
    Menu: {
      darkItemBg: "transparent",
      darkItemSelectedBg: "#2a1f00",
      darkItemSelectedColor: DUCKFLUX_GOLD,
      darkItemColor: "#b8c0cc",
      darkItemHoverColor: "#e0e6ed",
      darkItemHoverBg: "#1a2236",
    },
    Card: {
      colorBgContainer: "#131a2a",
      colorBorderSecondary: "#384456",
    },
    Table: {
      colorBgContainer: "#131a2a",
      headerBg: "#1a2236",
      rowHoverBg: "#1a2236",
      borderColor: "#384456",
    },
    Collapse: {
      headerBg: "#1a2236",
      contentBg: "#131a2a",
      colorBorder: "#384456",
    },
    Modal: {
      contentBg: "#131a2a",
      headerBg: "#131a2a",
    },
    Tag: {
      defaultBg: "#1a2236",
      defaultColor: "#b8c0cc",
    },
  },
};

const lightTheme: ThemeConfig = {
  algorithm: antTheme.defaultAlgorithm,
  token: {
    colorPrimary: DUCKFLUX_PURPLE,
    colorBgContainer: "#ffffff",
    colorBgElevated: "#ffffff",
    colorBgLayout: "#f2f2f8",
    colorBorder: "#d8d8e4",
    colorBorderSecondary: "#ececf2",
    colorText: "#1a1a2e",
    colorTextSecondary: "#33334d",
    colorTextTertiary: "#6b6b8a",
    fontFamily: "'Outfit', system-ui, sans-serif",
    fontFamilyCode: "'JetBrains Mono', ui-monospace, monospace",
    borderRadius: 6,
    colorLink: DUCKFLUX_PURPLE,
  },
  components: {
    Layout: {
      siderBg: "#ececf2",
      headerBg: "#ffffff",
      bodyBg: "#f2f2f8",
    },
    Menu: {
      itemBg: "transparent",
      itemSelectedBg: "#e8e8f0",
      itemSelectedColor: DUCKFLUX_PURPLE,
    },
    Collapse: {
      headerBg: "#f8f8fc",
      contentBg: "#ffffff",
    },
  },
};

interface ThemeProviderProps {
  children: React.ReactNode;
}

export default function ThemeProvider({ children }: ThemeProviderProps) {
  const [mode, setMode] = useState<ThemeMode>("dark");

  useEffect(() => {
    const saved = localStorage.getItem("duckflux-theme") as ThemeMode | null;
    if (saved === "light" || saved === "dark") {
      setMode(saved);
    } else if (window.matchMedia("(prefers-color-scheme: light)").matches) {
      setMode("light");
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("duckflux-theme", mode);
    document.documentElement.setAttribute("data-theme", mode);
  }, [mode]);

  const toggle = useCallback(() => {
    setMode((m) => (m === "dark" ? "light" : "dark"));
  }, []);

  const themeConfig = mode === "dark" ? darkTheme : lightTheme;

  return (
    <ThemeContext.Provider value={{ mode, toggle }}>
      <ConfigProvider theme={themeConfig}>{children}</ConfigProvider>
    </ThemeContext.Provider>
  );
}
