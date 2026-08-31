"use client";

import type { CSSProperties } from "react";
import { useState } from "react";

import { useViewerSession } from "../viewer-session";

type ViewerProfileResponse = {
  viewerKey: string;
  displayName: string;
  membership: {
    hasActiveMembership: boolean;
    activeExpiresAtUnix: number | null;
    totalMemberships: number;
  };
  entitlements: Array<{
    id: string;
    source: string;
    expiresAtUnix?: number | null;
    contentItem: {
      id: string;
      title: string;
      cloudVid: string;
      accessType: "FREE" | "VIP" | "PAID";
    };
  }>;
  recentOrders: Array<{
    id: string;
    orderNo: string;
    orderType: "MEMBERSHIP_PLAN" | "CONTENT_PURCHASE";
    status: "PENDING" | "PAID" | "CANCELED";
    amountCents: number;
    createdAt: string;
    paidAt?: string | null;
    membershipPlan?: {
      name: string;
    } | null;
    contentItem?: {
      title: string;
      cloudVid: string;
    } | null;
  }>;
  stats: {
    paidOrderCount: number;
    pendingOrderCount: number;
    entitlementCount: number;
  };
};

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3002/api";

function formatUnix(unix?: number | null) {
  if (!unix) {
    return "-";
  }

  return new Date(unix * 1000).toLocaleString("zh-CN");
}

function formatIso(value?: string | null) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString("zh-CN");
}

export function ViewerCenterClient() {
  const { viewerKey, setViewerKey } = useViewerSession();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("输入 viewerKey 后加载用户中心数据");
  const [profile, setProfile] = useState<ViewerProfileResponse | null>(null);

  async function loadProfile() {
    if (!viewerKey.trim()) {
      setMessage("请先输入 viewerKey");
      return;
    }

    setLoading(true);
    setMessage("正在加载用户中心数据...");

    try {
      const params = new URLSearchParams({
        viewerKey: viewerKey.trim()
      });
      const response = await fetch(
        `${apiBaseUrl}/media-ingestion/viewer-profile?${params.toString()}`
      );
      const data = (await response.json()) as ViewerProfileResponse & {
        message?: string;
      };

      if (!response.ok) {
        throw new Error(data.message ?? "用户中心数据加载失败");
      }

      setProfile(data);
      setMessage("用户中心数据加载成功");
    } catch (error) {
      setProfile(null);
      setMessage(error instanceof Error ? error.message : "用户中心数据加载失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <section style={cardStyle}>
        <h1 style={{ marginTop: 0 }}>用户中心</h1>
        <p style={{ color: "#4b5563", lineHeight: 1.7 }}>
          这里用于查看某个 viewerKey 的会员状态、已购内容和最近订单，验证前台权益闭环是否生效。
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto",
            gap: 12,
            alignItems: "end"
          }}
        >
          <label style={{ display: "grid", gap: 6 }}>
            <span>viewerKey</span>
            <input
              value={viewerKey}
              onChange={(event) => setViewerKey(event.target.value)}
              placeholder="viewer-demo-001"
              style={{ padding: 10, borderRadius: 10, border: "1px solid #d1d5db" }}
            />
          </label>
          <button type="button" onClick={() => void loadProfile()} style={buttonStyle}>
            {loading ? "加载中..." : "加载用户中心"}
          </button>
        </div>
        <div
          style={{
            marginTop: 16,
            padding: 12,
            borderRadius: 12,
            background: "#eff6ff",
            color: "#1d4ed8"
          }}
        >
          当前状态：{message}
        </div>
      </section>

      <section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>账号概览</h2>
        <div style={statsGrid}>
          <StatCard label="viewerKey" value={profile?.viewerKey ?? "-"} />
          <StatCard label="显示名称" value={profile?.displayName || "-"} />
          <StatCard
            label="会员状态"
            value={profile?.membership.hasActiveMembership ? "有效 VIP" : "无有效 VIP"}
          />
          <StatCard
            label="VIP 到期"
            value={formatUnix(profile?.membership.activeExpiresAtUnix ?? null)}
          />
          <StatCard label="已支付订单" value={String(profile?.stats.paidOrderCount ?? 0)} />
          <StatCard label="有效权益" value={String(profile?.stats.entitlementCount ?? 0)} />
        </div>
      </section>

      <section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>已购内容权益</h2>
        <div style={{ overflowX: "auto" }}>
          <table style={tableStyle}>
            <thead>
              <tr style={tableHeaderRow}>
                <th style={tableCell}>内容标题</th>
                <th style={tableCell}>cloudVid</th>
                <th style={tableCell}>访问类型</th>
                <th style={tableCell}>来源</th>
                <th style={tableCell}>到期时间</th>
              </tr>
            </thead>
            <tbody>
              {profile?.entitlements?.length ? (
                profile.entitlements.map((item) => (
                  <tr key={item.id} style={tableBodyRow}>
                    <td style={tableCell}>{item.contentItem.title}</td>
                    <td style={tableCell}>{item.contentItem.cloudVid}</td>
                    <td style={tableCell}>{item.contentItem.accessType}</td>
                    <td style={tableCell}>{item.source}</td>
                    <td style={tableCell}>{formatUnix(item.expiresAtUnix)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} style={tableCell}>
                    暂无有效内容权益
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>最近订单</h2>
        <div style={{ overflowX: "auto" }}>
          <table style={tableStyle}>
            <thead>
              <tr style={tableHeaderRow}>
                <th style={tableCell}>订单号</th>
                <th style={tableCell}>类型</th>
                <th style={tableCell}>状态</th>
                <th style={tableCell}>金额</th>
                <th style={tableCell}>关联对象</th>
                <th style={tableCell}>创建时间</th>
                <th style={tableCell}>支付时间</th>
              </tr>
            </thead>
            <tbody>
              {profile?.recentOrders?.length ? (
                profile.recentOrders.map((item) => (
                  <tr key={item.id} style={tableBodyRow}>
                    <td style={tableCell}>{item.orderNo}</td>
                    <td style={tableCell}>{item.orderType}</td>
                    <td style={tableCell}>{item.status}</td>
                    <td style={tableCell}>￥{(item.amountCents / 100).toFixed(2)}</td>
                    <td style={tableCell}>
                      {item.membershipPlan?.name ?? item.contentItem?.title ?? item.contentItem?.cloudVid ?? "-"}
                    </td>
                    <td style={tableCell}>{formatIso(item.createdAt)}</td>
                    <td style={tableCell}>{formatIso(item.paidAt)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} style={tableCell}>
                    暂无订单记录
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        padding: 16,
        borderRadius: 14,
        background: "#f8fafc",
        border: "1px solid #e5e7eb"
      }}
    >
      <div style={{ color: "#64748b", fontSize: 13 }}>{label}</div>
      <div style={{ marginTop: 8, fontSize: 18, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

const cardStyle: CSSProperties = {
  padding: 20,
  borderRadius: 16,
  background: "#fff",
  boxShadow: "0 10px 30px rgba(15, 23, 42, 0.06)"
};

const statsGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 12
};

const buttonStyle: CSSProperties = {
  padding: "10px 16px",
  borderRadius: 10,
  border: "none",
  background: "#2563eb",
  color: "#fff",
  cursor: "pointer"
};

const tableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse"
};

const tableHeaderRow: CSSProperties = {
  textAlign: "left",
  borderBottom: "1px solid #e5e7eb"
};

const tableBodyRow: CSSProperties = {
  borderBottom: "1px solid #f3f4f6"
};

const tableCell: CSSProperties = {
  padding: "12px 8px"
};
