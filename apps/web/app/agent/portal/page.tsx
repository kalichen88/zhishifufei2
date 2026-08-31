"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useState } from "react";

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3002/api";
const TOKEN_KEY = "knowledge-pay-agent-token";

type AgentProfile = {
  id: string;
  username: string;
  displayName: string;
  inviteCode: string;
};

type AgentStats = {
  balanceCents: number;
  referralCount: number;
  commissionTotalCents: number;
  pendingWithdrawalCents: number;
};

type CommissionItem = {
  id: string;
  orderId: string;
  level: "LEVEL_1" | "LEVEL_2";
  amountCents: number;
  createdAt: string;
};

type WithdrawalItem = {
  id: string;
  amountCents: number;
  accountInfo: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  note: string;
  createdAt: string;
};

function formatCents(value: number) {
  return `￥${(value / 100).toFixed(2)}`;
}

function formatIso(value: string) {
  return new Date(value).toLocaleString("zh-CN");
}

export default function AgentPortalPage() {
  const [profile, setProfile] = useState<AgentProfile | null>(null);
  const [stats, setStats] = useState<AgentStats | null>(null);
  const [commissions, setCommissions] = useState<CommissionItem[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalItem[]>([]);
  const [amount, setAmount] = useState("10");
  const [accountInfo, setAccountInfo] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const agentFetch = useCallback(
    async (path: string, init?: RequestInit) => {
      const token = window.localStorage.getItem(TOKEN_KEY) ?? "";
      const headers = new Headers(init?.headers);

      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
      }

      const response = await fetch(`${apiBaseUrl}/agent-portal${path}`, {
        ...init,
        headers
      });

      if (response.status === 401) {
        window.localStorage.removeItem(TOKEN_KEY);
        window.location.href = "/agent/login";
        throw new Error("登录已过期，请重新登录");
      }

      return response;
    },
    []
  );

  const loadAll = useCallback(async () => {
    setLoading(true);

    try {
      const [profileRes, statsRes, commissionRes, withdrawalRes] =
        await Promise.all([
          agentFetch("/profile"),
          agentFetch("/stats"),
          agentFetch("/commissions"),
          agentFetch("/withdrawals")
        ]);

      if (!profileRes.ok) throw new Error("代理信息加载失败");
      setProfile((await profileRes.json()) as AgentProfile);

      if (!statsRes.ok) throw new Error("统计数据加载失败");
      setStats((await statsRes.json()) as AgentStats);

      if (commissionRes.ok) {
        setCommissions((await commissionRes.json()) as CommissionItem[]);
      }

      if (withdrawalRes.ok) {
        setWithdrawals((await withdrawalRes.json()) as WithdrawalItem[]);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "数据加载失败");
    } finally {
      setLoading(false);
    }
  }, [agentFetch]);

  useEffect(() => {
    const token = window.localStorage.getItem(TOKEN_KEY);

    if (!token) {
      window.location.href = "/agent/login";
      return;
    }

    void loadAll();
  }, [loadAll]);

  async function submitWithdrawal() {
    const amountCents = Math.round(Number(amount) * 100);

    if (!Number.isFinite(amountCents) || amountCents < 1000) {
      setMessage("最低提现金额为 ￥10");
      return;
    }

    if (!accountInfo.trim()) {
      setMessage("请填写收款账户信息");
      return;
    }

    try {
      const response = await agentFetch("/withdrawals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountCents, accountInfo: accountInfo.trim() })
      });
      const data = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(data.message ?? "提现申请失败");
      }

      setMessage("提现申请已提交，等待管理员审核");
      await loadAll();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "提现申请失败");
    }
  }

  return (
    <main style={{ display: "grid", gap: 20, maxWidth: 1000, margin: "0 auto", padding: 24 }}>
      <div style={cardStyle}>
        <h1 style={{ marginTop: 0 }}>代理中心</h1>
        <div style={{ color: "#475569" }}>
          {profile ? `${profile.displayName}（${profile.username}）` : "加载中..."}
          {profile ? ` · 邀请码：${profile.inviteCode}` : ""}
        </div>
        {profile ? (
          <div style={{ color: "#2563eb", fontSize: 13 }}>
            推广链接：{typeof window !== "undefined" ? `${window.location.origin}/content?aid=${profile.inviteCode}` : ""}
          </div>
        ) : null}
      </div>

      <div style={statGridStyle}>
        <StatCard label="可提现余额" value={stats ? formatCents(stats.balanceCents) : "-"} />
        <StatCard label="推广用户数" value={stats ? String(stats.referralCount) : "-"} />
        <StatCard label="累计分润" value={stats ? formatCents(stats.commissionTotalCents) : "-"} />
        <StatCard label="待审提现" value={stats ? formatCents(stats.pendingWithdrawalCents) : "-"} />
      </div>

      <div style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>申请提现</h2>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={labelStyle}>
            金额（元，最低 10）
            <input
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              style={inputStyle}
            />
          </label>
          <label style={{ ...labelStyle, minWidth: 260 }}>
            收款账户（支付宝/微信/银行卡）
            <input
              value={accountInfo}
              onChange={(event) => setAccountInfo(event.target.value)}
              style={inputStyle}
            />
          </label>
          <button type="button" onClick={() => void submitWithdrawal()} style={buttonStyle}>
            提交申请
          </button>
          <button type="button" onClick={() => void loadAll()} style={{ ...buttonStyle, background: "#475569" }}>
            {loading ? "刷新中..." : "刷新数据"}
          </button>
        </div>
        {message ? <div style={messageStyle}>{message}</div> : null}
      </div>

      <div style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>分润明细</h2>
        {commissions.length === 0 ? (
          <div style={{ color: "#64748b" }}>暂无分润记录</div>
        ) : (
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>时间</th>
                <th style={thStyle}>订单号</th>
                <th style={thStyle}>级别</th>
                <th style={thStyle}>金额</th>
              </tr>
            </thead>
            <tbody>
              {commissions.map((item) => (
                <tr key={item.id}>
                  <td style={tdStyle}>{formatIso(item.createdAt)}</td>
                  <td style={tdStyle}>{item.orderId}</td>
                  <td style={tdStyle}>{item.level === "LEVEL_1" ? "一级" : "二级"}</td>
                  <td style={tdStyle}>{formatCents(item.amountCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>提现记录</h2>
        {withdrawals.length === 0 ? (
          <div style={{ color: "#64748b" }}>暂无提现记录</div>
        ) : (
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>时间</th>
                <th style={thStyle}>金额</th>
                <th style={thStyle}>账户</th>
                <th style={thStyle}>状态</th>
                <th style={thStyle}>备注</th>
              </tr>
            </thead>
            <tbody>
              {withdrawals.map((item) => (
                <tr key={item.id}>
                  <td style={tdStyle}>{formatIso(item.createdAt)}</td>
                  <td style={tdStyle}>{formatCents(item.amountCents)}</td>
                  <td style={tdStyle}>{item.accountInfo}</td>
                  <td style={tdStyle}>
                    {item.status === "PENDING" ? "待审核" : item.status === "APPROVED" ? "已通过" : "已拒绝"}
                  </td>
                  <td style={tdStyle}>{item.note || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={statCardStyle}>
      <div style={{ color: "#64748b", fontSize: 13 }}>{label}</div>
      <div style={{ marginTop: 8, fontSize: 22, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

const cardStyle: CSSProperties = {
  padding: 20,
  borderRadius: 16,
  background: "#fff",
  boxShadow: "0 10px 30px rgba(15, 23, 42, 0.06)"
};

const statGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 12
};

const statCardStyle: CSSProperties = {
  padding: 16,
  borderRadius: 14,
  background: "#f8fafc",
  border: "1px solid #e5e7eb"
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
  marginTop: 12,
  padding: 10,
  borderRadius: 10,
  background: "#eff6ff",
  color: "#1d4ed8",
  fontSize: 14
};

const tableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 14
};

const thStyle: CSSProperties = {
  textAlign: "left",
  padding: "8px 10px",
  borderBottom: "1px solid #e5e7eb",
  color: "#64748b"
};

const tdStyle: CSSProperties = {
  padding: "8px 10px",
  borderBottom: "1px solid #f1f5f9"
};
