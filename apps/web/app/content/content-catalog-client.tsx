"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { useEffect, useState } from "react";

import { useViewerSession } from "../viewer-session";

type ContentCatalogItem = {
  id: string;
  title: string;
  cloudVid: string;
  accessType: "FREE" | "VIP" | "PAID";
  previewDurationSec: number;
  priceCents: number;
  publishState: "PUBLISHED";
  updatedAt: string;
  orderCount: number;
};

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3002/api";

function formatIso(value: string) {
  return new Date(value).toLocaleString("zh-CN");
}

export function ContentCatalogClient() {
  const { viewerKey, setViewerKey } = useViewerSession();
  const [items, setItems] = useState<ContentCatalogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("正在准备内容目录...");
  const [keyword, setKeyword] = useState("");
  const [accessType, setAccessType] = useState<"ALL" | "FREE" | "VIP" | "PAID">("ALL");

  async function loadCatalog() {
    setLoading(true);
    setMessage("正在加载内容目录...");

    try {
      const params = new URLSearchParams({
        page: "1",
        pageSize: "50"
      });
      if (keyword.trim()) {
        params.set("keyword", keyword.trim());
      }
      if (accessType !== "ALL") {
        params.set("accessType", accessType);
      }

      const response = await fetch(
        `${apiBaseUrl}/media-ingestion/content-catalog?${params.toString()}`
      );
      const data = (await response.json()) as {
        items?: ContentCatalogItem[];
        message?: string;
      };

      if (!response.ok) {
        throw new Error(data.message ?? "内容目录加载失败");
      }

      setItems(data.items ?? []);
      setMessage(`已加载 ${data.items?.length ?? 0} 条内容`);
    } catch (error) {
      setItems([]);
      setMessage(error instanceof Error ? error.message : "内容目录加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadCatalog();
    const url = new URL(window.location.href);
    const aid = url.searchParams.get("aid")?.trim();

    if (aid) {
      window.localStorage.setItem("knowledge-pay-referral-aid", aid);
    }
  }, []);

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <section style={cardStyle}>
        <h1 style={{ marginTop: 0 }}>内容目录</h1>
        <p style={{ color: "#4b5563", lineHeight: 1.7 }}>
          这里展示已经发布的内容项，可直接进入详情页做购买、会员解锁和播放联动测试。
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 220px 240px auto",
            gap: 12,
            alignItems: "end"
          }}
        >
          <label style={{ display: "grid", gap: 6 }}>
            <span>关键词</span>
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="输入标题或 cloudVid"
              style={inputStyle}
            />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span>访问类型</span>
            <select
              value={accessType}
              onChange={(event) =>
                setAccessType(event.target.value as "ALL" | "FREE" | "VIP" | "PAID")
              }
              style={inputStyle}
            >
              <option value="ALL">全部</option>
              <option value="FREE">FREE</option>
              <option value="VIP">VIP</option>
              <option value="PAID">PAID</option>
            </select>
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span>当前 viewerKey</span>
            <input
              value={viewerKey}
              onChange={(event) => setViewerKey(event.target.value)}
              placeholder="viewer-demo-001"
              style={inputStyle}
            />
          </label>
          <button type="button" onClick={() => void loadCatalog()} style={buttonStyle}>
            {loading ? "加载中..." : "刷新目录"}
          </button>
        </div>
        <div style={statusStyle}>当前状态：{message}</div>
      </section>

      <section style={cardStyle}>
        <div style={catalogGrid}>
          {items.length === 0 ? (
            <div style={emptyStyle}>暂无可展示内容</div>
          ) : (
            items.map((item) => (
              <article key={item.id} style={itemCardStyle}>
                <div style={{ display: "grid", gap: 8 }}>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>{item.title}</div>
                  <div style={{ color: "#64748b" }}>cloudVid：{item.cloudVid}</div>
                  <div style={{ color: "#334155" }}>访问类型：{item.accessType}</div>
                  <div style={{ color: "#334155" }}>
                    价格：￥{(item.priceCents / 100).toFixed(2)}
                  </div>
                  <div style={{ color: "#334155" }}>预览时长：{item.previewDurationSec} 秒</div>
                  <div style={{ color: "#334155" }}>订单数：{item.orderCount}</div>
                  <div style={{ color: "#94a3b8" }}>更新时间：{formatIso(item.updatedAt)}</div>
                </div>
                <div style={{ marginTop: 16 }}>
                  <Link
                    href={`/content/${encodeURIComponent(item.cloudVid)}`}
                    style={{ color: "#2563eb" }}
                  >
                    查看详情
                  </Link>
                </div>
              </article>
            ))
          )}
        </div>
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

const catalogGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: 16
};

const itemCardStyle: CSSProperties = {
  padding: 18,
  borderRadius: 16,
  border: "1px solid #e5e7eb",
  background: "#f8fafc"
};

const inputStyle: CSSProperties = {
  padding: 10,
  borderRadius: 10,
  border: "1px solid #d1d5db"
};

const buttonStyle: CSSProperties = {
  padding: "10px 16px",
  borderRadius: 10,
  border: "none",
  background: "#2563eb",
  color: "#fff",
  cursor: "pointer"
};

const statusStyle: CSSProperties = {
  marginTop: 16,
  padding: 12,
  borderRadius: 12,
  background: "#eff6ff",
  color: "#1d4ed8"
};

const emptyStyle: CSSProperties = {
  padding: 24,
  borderRadius: 16,
  background: "#f8fafc",
  color: "#64748b"
};
