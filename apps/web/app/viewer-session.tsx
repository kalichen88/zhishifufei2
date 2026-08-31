"use client";

import type { CSSProperties, ReactNode } from "react";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";

type ViewerSessionValue = {
  viewerKey: string;
  setViewerKey: (value: string) => void;
};

const STORAGE_KEY = "knowledge-pay-viewer-key";

const ViewerSessionContext = createContext<ViewerSessionValue | null>(null);

export function ViewerSessionProvider({ children }: { children: ReactNode }) {
  const [viewerKey, setViewerKeyState] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY) ?? "";
    setViewerKeyState(saved);
    setReady(true);
  }, []);

  const value = useMemo<ViewerSessionValue>(
    () => ({
      viewerKey,
      setViewerKey: (nextValue: string) => {
        setViewerKeyState(nextValue);
        window.localStorage.setItem(STORAGE_KEY, nextValue);
      }
    }),
    [viewerKey]
  );

  if (!ready) {
    return <div style={loadingStyle}>正在恢复当前登录身份...</div>;
  }

  return <ViewerSessionContext.Provider value={value}>{children}</ViewerSessionContext.Provider>;
}

export function useViewerSession() {
  const context = useContext(ViewerSessionContext);

  if (!context) {
    throw new Error("useViewerSession 必须在 ViewerSessionProvider 内使用");
  }

  return context;
}

const loadingStyle: CSSProperties = {
  minHeight: "100vh",
  display: "grid",
  placeItems: "center",
  background: "#f7f8fb",
  color: "#475569"
};
