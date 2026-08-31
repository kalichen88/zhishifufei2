"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { clearAdminSession, getAdminInfo, type AdminInfo } from "./admin-session";

export function AdminNav() {
  const [admin, setAdmin] = useState<AdminInfo | null>(null);

  useEffect(() => {
    setAdmin(getAdminInfo());
  }, []);

  function handleLogout() {
    clearAdminSession();
    window.location.href = "/login";
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      <Link href="/" style={linkStyle}>
        总览
      </Link>
      <Link href="/resources" style={linkStyle}>
        资源中心
      </Link>
      <Link href="/agents" style={linkStyle}>
        代理管理
      </Link>
      {admin ? (
        <>
          <span style={{ fontSize: 13, opacity: 0.8 }}>
            {admin.displayName || admin.username}
          </span>
          <button onClick={handleLogout} style={logoutStyle}>
            退出登录
          </button>
        </>
      ) : (
        <Link href="/login" style={linkStyle}>
          登录
        </Link>
      )}
    </div>
  );
}

const linkStyle = {
  color: "#fff",
  textDecoration: "none"
} as const;

const logoutStyle = {
  padding: "4px 10px",
  border: "1px solid rgba(255,255,255,0.4)",
  borderRadius: 6,
  background: "transparent",
  color: "#fff",
  fontSize: 13,
  cursor: "pointer"
} as const;
