import type { ReactNode } from "react";
import Link from "next/link";

import { ViewerSessionProvider } from "./viewer-session";

export default function RootLayout({
  children
}: {
  children: ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body
        style={{
          margin: 0,
          fontFamily:
            "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          background: "#f7f8fb",
          color: "#111827"
        }}
      >
        <ViewerSessionProvider>
          <header
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "16px 24px",
              background: "#111827",
              color: "#fff"
            }}
          >
            <div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>知识付费系统前台</div>
              <div style={{ fontSize: 12, opacity: 0.75 }}>重写版播放链路骨架</div>
            </div>
            <nav style={{ display: "flex", gap: 16 }}>
              <Link href="/" style={{ color: "#fff", textDecoration: "none" }}>
                首页
              </Link>
              <Link href="/play" style={{ color: "#fff", textDecoration: "none" }}>
                播放测试
              </Link>
              <Link href="/content" style={{ color: "#fff", textDecoration: "none" }}>
                内容目录
              </Link>
              <Link href="/me" style={{ color: "#fff", textDecoration: "none" }}>
                用户中心
              </Link>
            </nav>
          </header>
          {children}
        </ViewerSessionProvider>
      </body>
    </html>
  );
}
