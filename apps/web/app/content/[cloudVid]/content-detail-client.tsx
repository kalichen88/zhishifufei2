"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { useEffect, useState } from "react";

import { useViewerSession } from "../../viewer-session";

type ContentDetailResponse = {
  id: string;
  title: string;
  cloudVid: string;
  accessType: "FREE" | "VIP" | "PAID";
  previewDurationSec: number;
  priceCents: number;
  publishState: "PUBLISHED";
  updatedAt: string;
  asset: {
    title: string;
    categoryName: string;
    durationSec: number;
    staticCoverUrl?: string | null;
    gifCoverUrl?: string | null;
    cloudSyncState: "ACTIVE" | "OFFLINE" | "DELETED";
  } | null;
  viewerAccess: {
    viewerKey: string | null;
    hasActiveMembership: boolean;
    hasEntitlement: boolean;
    canPlay: boolean;
  };
};

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3002/api";

function formatIso(value: string) {
  return new Date(value).toLocaleString("zh-CN");
}

function getReferralCode(): string {
  if (typeof window === "undefined") {
    return "";
  }

  // 代理推广链接 ?aid=邀请码，首次访问后长期缓存
  const url = new URL(window.location.href);
  const aid = url.searchParams.get("aid")?.trim() ?? "";

  if (aid) {
    window.localStorage.setItem("knowledge-pay-referral-aid", aid);
  }

  return window.localStorage.getItem("knowledge-pay-referral-aid") ?? "";
}

export function ContentDetailClient({ cloudVid }: { cloudVid: string }) {
  const { viewerKey, setViewerKey } = useViewerSession();
  const [content, setContent] = useState<ContentDetailResponse | null>(null);
  const [message, setMessage] = useState("正在准备内容详情...");
  const [loading, setLoading] = useState(false);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [completingOrder, setCompletingOrder] = useState(false);
  const [payingOnline, setPayingOnline] = useState(false);
  const [latestOrderNo, setLatestOrderNo] = useState("");
  const [referralCode, setReferralCode] = useState("");

  async function loadDetail(currentViewerKey = viewerKey) {
    setLoading(true);
    setMessage("正在加载内容详情...");

    try {
      const params = new URLSearchParams({
        cloudVid
      });
      if (currentViewerKey.trim()) {
        params.set("viewerKey", currentViewerKey.trim());
      }

      const response = await fetch(
        `${apiBaseUrl}/media-ingestion/content-detail?${params.toString()}`
      );
      const data = (await response.json()) as ContentDetailResponse & {
        message?: string;
      };

      if (!response.ok) {
        throw new Error(data.message ?? "内容详情加载失败");
      }

      setContent(data);
      setMessage("内容详情加载成功");
    } catch (error) {
      setContent(null);
      setMessage(error instanceof Error ? error.message : "内容详情加载失败");
    } finally {
      setLoading(false);
    }
  }

  async function createOrder() {
    if (!viewerKey.trim()) {
      setMessage("请先输入 viewerKey");
      return;
    }

    if (!content) {
      setMessage("请先加载内容详情");
      return;
    }

    if (content.accessType === "FREE") {
      setMessage("免费内容无需下单，可直接去播放页验证");
      return;
    }

    setCreatingOrder(true);
    setMessage(content.accessType === "VIP" ? "正在创建会员订单..." : "正在创建内容订单...");

    try {
      const targetUrl =
        content.accessType === "VIP"
          ? `${apiBaseUrl}/media-ingestion/orders/membership`
          : `${apiBaseUrl}/media-ingestion/orders/content`;
      const body: {
        viewerKey: string;
        membershipPlanId?: string;
        cloudVid?: string;
        referralCode?: string;
      } =
        content.accessType === "VIP"
          ? {
              viewerKey: viewerKey.trim(),
              membershipPlanId: undefined as string | undefined
            }
          : {
              viewerKey: viewerKey.trim(),
              cloudVid
            };

      if (referralCode.trim()) {
        body.referralCode = referralCode.trim();
      }

      if (content.accessType === "VIP") {
        const plansResponse = await fetch(
          `${apiBaseUrl}/media-ingestion/membership-plans?page=1&pageSize=20`
        );
        const plansData = (await plansResponse.json()) as {
          items?: Array<{ id: string; isActive: boolean }>;
          message?: string;
        };

        if (!plansResponse.ok) {
          throw new Error(plansData.message ?? "会员方案加载失败");
        }

        const activePlan = plansData.items?.find((item) => item.isActive);
        if (!activePlan) {
          throw new Error("当前没有可用的会员方案");
        }

        body.membershipPlanId = activePlan.id;
      }

      const response = await fetch(targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      });
      const data = (await response.json()) as { orderNo?: string; message?: string };

      if (!response.ok) {
        throw new Error(data.message ?? "订单创建失败");
      }

      setLatestOrderNo(data.orderNo ?? "");
      setMessage(`订单创建成功：${data.orderNo ?? "-"}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "订单创建失败");
    } finally {
      setCreatingOrder(false);
    }
  }

  async function completeOrder() {
    if (!latestOrderNo.trim()) {
      setMessage("请先创建订单");
      return;
    }

    setCompletingOrder(true);
    setMessage("正在模拟支付完成...");

    try {
      const response = await fetch(`${apiBaseUrl}/media-ingestion/orders/complete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          orderNo: latestOrderNo.trim()
        })
      });
      const data = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(data.message ?? "支付完成处理失败");
      }

      await loadDetail(viewerKey);
      setMessage(`订单已支付完成：${latestOrderNo}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "支付完成处理失败");
    } finally {
      setCompletingOrder(false);
    }
  }

  async function payOnline(payType: "alipay" | "wxpay") {
    if (!latestOrderNo.trim()) {
      setMessage("请先创建订单");
      return;
    }

    setPayingOnline(true);
    setMessage("正在获取支付链接...");

    try {
      const params = new URLSearchParams({
        orderNo: latestOrderNo.trim(),
        type: payType
      });
      const response = await fetch(
        `${apiBaseUrl}/payments/epay/create?${params.toString()}`
      );
      const data = (await response.json()) as {
        payUrl?: string;
        message?: string;
      };

      if (!response.ok || !data.payUrl) {
        throw new Error(data.message ?? "支付链接获取失败");
      }

      setMessage("正在跳转支付收银台...");
      window.location.href = data.payUrl;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "支付链接获取失败");
      setPayingOnline(false);
    }
  }

  useEffect(() => {
    void loadDetail();
    setReferralCode(getReferralCode());
  }, [cloudVid]);

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <section style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ marginTop: 0 }}>{content?.title ?? cloudVid}</h1>
            <div style={{ color: "#64748b", lineHeight: 1.8 }}>
              <div>cloudVid：{cloudVid}</div>
              <div>访问类型：{content?.accessType ?? "-"}</div>
              <div>价格：￥{((content?.priceCents ?? 0) / 100).toFixed(2)}</div>
              <div>更新时间：{content ? formatIso(content.updatedAt) : "-"}</div>
            </div>
          </div>
          <div style={{ minWidth: 280, display: "grid", gap: 12 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span>viewerKey</span>
              <input value={viewerKey} onChange={(event) => setViewerKey(event.target.value)} style={inputStyle} />
            </label>
            <button type="button" onClick={() => void loadDetail()} style={buttonStyle}>
              {loading ? "加载中..." : "刷新详情"}
            </button>
          </div>
        </div>
        <div style={statusStyle}>当前状态：{message}</div>
      </section>

      <section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>内容信息</h2>
        <div style={detailGrid}>
          <InfoCard label="资源状态" value={content?.asset?.cloudSyncState ?? "-"} />
          <InfoCard label="资源分类" value={content?.asset?.categoryName ?? "-"} />
          <InfoCard label="时长" value={`${content?.asset?.durationSec ?? 0} 秒`} />
          <InfoCard label="试看时长" value={`${content?.previewDurationSec ?? 0} 秒`} />
        </div>
      </section>

      <section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>当前账号可访问性</h2>
        <div style={detailGrid}>
          <InfoCard
            label="VIP 状态"
            value={content?.viewerAccess.hasActiveMembership ? "有效" : "无效"}
          />
          <InfoCard
            label="购买状态"
            value={content?.viewerAccess.hasEntitlement ? "已购" : "未购"}
          />
          <InfoCard label="是否可播放" value={content?.viewerAccess.canPlay ? "可以" : "不可以"} />
          <InfoCard label="最近订单号" value={latestOrderNo || "-"} />
        </div>
      </section>

      <section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>操作</h2>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button type="button" onClick={() => void createOrder()} style={buttonStyle}>
            {creatingOrder
              ? "处理中..."
              : content?.accessType === "VIP"
                ? "创建会员订单"
                : content?.accessType === "PAID"
                  ? "创建内容订单"
                  : "无需下单"}
          </button>
          <button
            type="button"
            onClick={() => void completeOrder()}
            style={{ ...buttonStyle, background: "#059669" }}
          >
            {completingOrder ? "处理中..." : "模拟支付完成"}
          </button>
          {latestOrderNo ? (
            <>
              <button
                type="button"
                disabled={payingOnline}
                onClick={() => void payOnline("alipay")}
                style={{ ...buttonStyle, background: "#1677ff" }}
              >
                {payingOnline ? "处理中..." : "在线支付（支付宝）"}
              </button>
              <button
                type="button"
                disabled={payingOnline}
                onClick={() => void payOnline("wxpay")}
                style={{ ...buttonStyle, background: "#07c160" }}
              >
                在线支付（微信）
              </button>
            </>
          ) : null}
          <Link
            href={`/play?vid=${encodeURIComponent(cloudVid)}`}
            style={{ ...linkButtonStyle, textDecoration: "none" }}
          >
            去播放页验证
          </Link>
          <Link href="/content" style={{ color: "#2563eb", alignSelf: "center" }}>
            返回内容目录
          </Link>
        </div>
      </section>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={infoCardStyle}>
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

const detailGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 12
};

const infoCardStyle: CSSProperties = {
  padding: 16,
  borderRadius: 14,
  background: "#f8fafc",
  border: "1px solid #e5e7eb"
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

const linkButtonStyle: CSSProperties = {
  padding: "10px 16px",
  borderRadius: 10,
  background: "#7c3aed",
  color: "#fff",
  display: "inline-flex",
  alignItems: "center"
};

const statusStyle: CSSProperties = {
  marginTop: 16,
  padding: 12,
  borderRadius: 12,
  background: "#eff6ff",
  color: "#1d4ed8"
};
