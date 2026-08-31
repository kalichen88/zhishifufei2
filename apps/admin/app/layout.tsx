import type { ReactNode } from "react";

import { AdminNav } from "./admin-nav";

export default function AdminLayout({
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
          background: "#f5f7fb",
          color: "#1f2937"
        }}
      >
        <div style={{ minHeight: "100vh" }}>
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
              <div style={{ fontSize: 20, fontWeight: 700 }}>知识付费系统管理台</div>
              <div style={{ fontSize: 12, opacity: 0.75 }}>
                重写版后台骨架
              </div>
            </div>
            <AdminNav />
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
