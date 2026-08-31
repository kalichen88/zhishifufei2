"use client";

import type { CSSProperties } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { saveAdminSession } from "../admin-session";

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3002/api";

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");

    try {
      const response = await fetch(`${apiBaseUrl}/admin-auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      const data = (await response.json()) as {
        accessToken?: string;
        admin?: Parameters<typeof saveAdminSession>[1];
        message?: string;
      };

      if (!response.ok || !data.accessToken || !data.admin) {
        throw new Error(data.message ?? "登录失败");
      }

      saveAdminSession(data.accessToken, data.admin);
      router.push("/resources");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "登录失败");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main style={pageStyle}>
      <form onSubmit={handleSubmit} style={cardStyle}>
        <h1 style={{ marginTop: 0, fontSize: 22 }}>管理台登录</h1>
        <label style={labelStyle}>
          用户名
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            style={inputStyle}
            autoComplete="username"
          />
        </label>
        <label style={labelStyle}>
          密码
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            style={inputStyle}
            autoComplete="current-password"
          />
        </label>
        {message ? <p style={{ color: "#dc2626", margin: "0 0 12px" }}>{message}</p> : null}
        <button type="submit" disabled={submitting} style={buttonStyle}>
          {submitting ? "登录中..." : "登录"}
        </button>
      </form>
    </main>
  );
}

const pageStyle: CSSProperties = {
  minHeight: "calc(100vh - 73px)",
  display: "grid",
  placeItems: "center"
};

const cardStyle: CSSProperties = {
  width: 320,
  padding: 28,
  display: "flex",
  flexDirection: "column",
  gap: 14,
  background: "#fff",
  borderRadius: 16,
  boxShadow: "0 10px 30px rgba(15, 23, 42, 0.08)"
};

const labelStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  fontSize: 14,
  color: "#374151"
};

const inputStyle: CSSProperties = {
  padding: "10px 12px",
  border: "1px solid #d1d5db",
  borderRadius: 8,
  fontSize: 14
};

const buttonStyle: CSSProperties = {
  padding: "10px 0",
  border: "none",
  borderRadius: 8,
  background: "#111827",
  color: "#fff",
  fontSize: 15,
  cursor: "pointer"
};
