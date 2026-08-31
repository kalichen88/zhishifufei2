"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useState } from "react";

import { adminFetch } from "../admin-session";

type AgentItem = {
  id: string;
  username: string;
  displayName: string;
  inviteCode: string;
  commissionRateL1: number;
  commissionRateL2: number;
  balanceCents: number;
  status: "ACTIVE" | "DISABLED";
  referralCount: number;
  commissionTotalCents: number;
  pendingWithdrawalCents: number;
  referredBy?: { id: string; username: string } | null;
};

type WithdrawalItem = {
  id: string;
  agent: { id: string; username: string; displayName: string };
  amountCents: number;
  accountInfo: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  note: string;
  createdAt: string;
};

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3002/api";

function formatCents(value: number) {
  return `￥${(value / 100).toFixed(2)}`;
}

function formatRate(value: number) {
  return `${(value / 100).toFixed(1)}%`;
}

function formatIso(value: string) {
  return new Date(value).toLocaleString("zh-CN");
}

export function AgentsClient() {
  const [agents, setAgents] = useState<AgentItem[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalItem[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    username: "",
    password: "",
    displayName: "",
    rateL1: "30",
    rateL2: "10"
  });

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const [agentsRes, withdrawalsRes] = await Promise.all([
        adminFetch(`${apiBaseUrl}/agents`),
        adminFetch(`${apiBaseUrl}/agents/withdrawals`)
      ]);
      const agentsData = (await agentsRes.json()) as AgentItem[] & {
        message?: string;
      };

      if (!agentsRes.ok) {
        throw new Error(agentsData.message ?? "代理列表加载失败");
      }

      setAgents(agentsData);

      if (withdrawalsRes.ok) {
        setWithdrawals((await withdrawalsRes.json()) as WithdrawalItem[]);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "数据加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createAgent() {
    try {
      const response = await adminFetch(`${apiBaseUrl}/agents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: form.username.trim(),
          password: form.password,
          displayName: form.displayName.trim() || form.username.trim(),
          commissionRateL1: Math.round(Number(form.rateL1) * 100),
          commissionRateL2: Math.round(Number(form.rateL2) * 100)
        })
      });
      const data = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(data.message ?? "创建代理失败");
      }

      setMessage("代理创建成功");
      setForm({ username: "", password: "", displayName: "", rateL1: "30", rateL2: "10" });
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "创建代理失败");
    }
  }

  async function updateAgent(id: string, patch: Record<string, unknown>) {
    try {
      const response = await adminFetch(`${apiBaseUrl}/agents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch)
      });
      const data = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(data.message ?? "更新失败");
      }

      setMessage("代理已更新");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "更新失败");
    }
  }

  async function reviewWithdrawal(id: string, action: "APPROVED" | "REJECTED") {
    try {
      const response = await adminFetch(`${apiBaseUrl}/agents/withdrawals/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ withdrawalId: id, action })
      });
      const data = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(data.message ?? "审核失败");
      }

      setMessage(action === "APPROVED" ? "提现已通过" : "提现已拒绝并退回余额");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "审核失败");
    }
  }

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>创建代理</h2>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={labelStyle}>
            用户名
            <input value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} style={inputStyle} />
          </label>
          <label style={labelStyle}>
            初始密码
            <input value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} style={inputStyle} />
          </label>
          <label style={labelStyle}>
            显示名
            <input value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} style={inputStyle} />
          </label>
          <label style={labelStyle}>
            一级比例 %
            <input value={form.rateL1} onChange={(event) => setForm({ ...form, rateL1: event.target.value })} style={inputStyle} />
          </label>
          <label style={labelStyle}>
            二级比例 %
            <input value={form.rateL2} onChange={(event) => setForm({ ...form, rateL2: event.target.value })} style={inputStyle} />
          </label>
          <button type="button" onClick={() => void createAgent()} style={buttonStyle}>
            创建代理
          </button>
        </div>
        {message ? <div style={messageStyle}>{message}</div> : null}
      </section>

      <section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>代理列表 {loading ? "（加载中）" : ""}</h2>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>用户名</th>
              <th style={thStyle}>邀请码</th>
              <th style={thStyle}>比例（L1/L2）</th>
              <th style={thStyle}>余额</th>
              <th style={thStyle}>推广数</th>
              <th style={thStyle}>累计分润</th>
              <th style={thStyle}>状态</th>
              <th style={thStyle}>操作</th>
            </tr>
          </thead>
          <tbody>
            {agents.map((agent) => (
              <tr key={agent.id}>
                <td style={tdStyle}>
                  {agent.displayName}（{agent.username}）
                  {agent.referredBy ? <div style={{ fontSize: 12, color: "#64748b" }}>上级：{agent.referredBy.username}</div> : null}
                </td>
                <td style={tdStyle}>{agent.inviteCode}</td>
                <td style={tdStyle}>
                  {formatRate(agent.commissionRateL1)} / {formatRate(agent.commissionRateL2)}
                </td>
                <td style={tdStyle}>{formatCents(agent.balanceCents)}</td>
                <td style={tdStyle}>{agent.referralCount}</td>
                <td style={tdStyle}>{formatCents(agent.commissionTotalCents)}</td>
                <td style={tdStyle}>{agent.status === "ACTIVE" ? "启用" : "停用"}</td>
                <td style={tdStyle}>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button type="button" style={smallButtonStyle} onClick={() => void updateAgent(agent.id, { status: agent.status === "ACTIVE" ? "DISABLED" : "ACTIVE" })}>
                      {agent.status === "ACTIVE" ? "停用" : "启用"}
                    </button>
                    <button
                      type="button"
                      style={{ ...smallButtonStyle, background: "#7c3aed" }}
                      onClick={() => {
                        const input = window.prompt("输入新的一级比例 %（如 25）", String(agent.commissionRateL1 / 100));

                        if (input === null) return;

                        const l1 = Math.round(Number(input) * 100);
                        const input2 = window.prompt("输入新的二级比例 %", String(agent.commissionRateL2 / 100));

                        if (input2 === null) return;

                        void updateAgent(agent.id, { commissionRateL1: l1, commissionRateL2: Math.round(Number(input2) * 100) });
                      }}
                    >
                      改比例
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>提现审核</h2>
        {withdrawals.length === 0 ? (
          <div style={{ color: "#64748b" }}>暂无提现申请</div>
        ) : (
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>时间</th>
                <th style={thStyle}>代理</th>
                <th style={thStyle}>金额</th>
                <th style={thStyle}>账户</th>
                <th style={thStyle}>状态</th>
                <th style={thStyle}>操作</th>
              </tr>
            </thead>
            <tbody>
              {withdrawals.map((item) => (
                <tr key={item.id}>
                  <td style={tdStyle}>{formatIso(item.createdAt)}</td>
                  <td style={tdStyle}>{item.agent?.displayName ?? item.agent?.username}</td>
                  <td style={tdStyle}>{formatCents(item.amountCents)}</td>
                  <td style={tdStyle}>{item.accountInfo}</td>
                  <td style={tdStyle}>
                    {item.status === "PENDING" ? "待审核" : item.status === "APPROVED" ? "已通过" : "已拒绝"}
                  </td>
                  <td style={tdStyle}>
                    {item.status === "PENDING" ? (
                      <div style={{ display: "flex", gap: 6 }}>
                        <button type="button" style={{ ...smallButtonStyle, background: "#059669" }} onClick={() => void reviewWithdrawal(item.id, "APPROVED")}>
                          通过
                        </button>
                        <button type="button" style={{ ...smallButtonStyle, background: "#dc2626" }} onClick={() => void reviewWithdrawal(item.id, "REJECTED")}>
                          拒绝
                        </button>
                      </div>
                    ) : (
                      "-"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

const cardStyle: CSSProperties = {
  padding: 20,
  borderRadius: 16,
  background: "#fff",
  boxShadow: "0 10px 30px rgba(15, 23, 42, 0.06)"
};

const labelStyle: CSSProperties = {
  display: "grid",
  gap: 6,
  fontSize: 13,
  color: "#334155"
};

const inputStyle: CSSProperties = {
  padding: 8,
  borderRadius: 8,
  border: "1px solid #d1d5db"
};

const buttonStyle: CSSProperties = {
  padding: "9px 14px",
  borderRadius: 8,
  border: "none",
  background: "#2563eb",
  color: "#fff",
  cursor: "pointer"
};

const smallButtonStyle: CSSProperties = {
  padding: "4px 10px",
  borderRadius: 6,
  border: "none",
  background: "#475569",
  color: "#fff",
  fontSize: 12,
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
