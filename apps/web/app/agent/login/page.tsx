"use client";

import type { CSSProperties } from "react";
import { useState } from "react";

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3002/api";

export default function AgentLoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(`${apiBaseUrl}/agent-auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      const data = (await response.json()) as {
        accessToken?: string;
        message?: string;
      };

      if (!response.ok || !data.accessToken) {
        throw new Error(data.message ?? "登录失败");
      }

      window.localStorage.setItem("knowledge-pay-agent-token", data.accessToken);
      window.location.href = "/agent/portal";
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "登录失败");
      setLoading(false);
    }
  }

  return (
    <main style={pageStyle}>
      <div style={cardStyle}>
        <h1>代理登录</h1>
        <label style={labelStyle}>
          用户名
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            style={inputStyle}
          />
        </label>
        <label style={labelStyle}>
          密码
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            style={inputStyle}
          />
        </label>
        <button type="button" onClick={() => void handleLogin()} style={buttonStyle}>
          {loading ? "登录中..." : "登录代理中心"}
        </button>
        {message ? <div style={messageStyle}>{message}</div> : null}
      </div>
    </main>
  );
}

const pageStyle: CSSProperties = {
  minHeight: "70vh",
  display: "grid",
  placeItems: "center",
  padding: 24
};

const cardStyle: CSSProperties = {
  width: "min(420px, 100%)",
  padding: 28,
  borderRadius: 16,
  background: "#fff",
  boxShadow: "0 10px 30px rgba(15, 23, 42, 0.08)",
  display: "grid",
  gap: 14
};

const labelStyle: CSSProperties = {
  display: "grid",
  gap: 6,
  fontSize: 14,
  color: "#334155"
};

const inputStyle: CSSProperties = {
  padding: 10,
  borderRadius: 10,
  border: "1px solid #d1d5db"
};

const buttonStyle: CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "none",
  background: "#2563eb",
  color: "#fff",
  cursor: "pointer"
};

const messageStyle: CSSProperties = {
  padding: 10,
  borderRadius: 10,
  background: "#fef2f2",
  color: "#b91c1c",
  fontSize: 14
};
