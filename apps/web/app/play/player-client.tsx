"use client";

import Hls from "hls.js";
import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import { useViewerSession } from "../viewer-session";

type PlaybackAuthorizeResponse = {
  cloudVid: string;
  title: string;
  accessType?: "FREE" | "VIP" | "PAID";
  contentConfigured?: boolean;
  expiresAt: number;
  resourceUrl?: string;
  resourceUrl2?: string;
  staticCoverUrl?: string;
  gifCoverUrl?: string;
  playUrl?: string;
  source: "cache" | "renew";
};

type MembershipPlanItem = {
  id: string;
  name: string;
  durationDays: number;
  priceCents: number;
  isActive: boolean;
};

type ViewerOrderItem = {
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
};

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3002/api";

function formatUnix(unix: number) {
  if (!unix) {
    return "-";
  }

  return new Date(unix * 1000).toLocaleString("zh-CN");
}

export function PlayerClient({ initialVid }: { initialVid: string }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const { viewerKey, setViewerKey } = useViewerSession();

  const [cloudVid, setCloudVid] = useState(initialVid);
  const [ttl, setTtl] = useState("3600");
  const [loading, setLoading] = useState(false);
  const [membershipPlans, setMembershipPlans] = useState<MembershipPlanItem[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [orders, setOrders] = useState<ViewerOrderItem[]>([]);
  const [creatingMembershipOrder, setCreatingMembershipOrder] = useState(false);
  const [creatingContentOrder, setCreatingContentOrder] = useState(false);
  const [completingOrder, setCompletingOrder] = useState(false);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [latestOrderNo, setLatestOrderNo] = useState("");
  const [message, setMessage] = useState("请输入 cloudVid 后请求播放授权");
  const [result, setResult] = useState<PlaybackAuthorizeResponse | null>(null);

  const currentSource = useMemo(
    () => result?.resourceUrl || result?.resourceUrl2 || "",
    [result]
  );

  const selectedPlan = useMemo(
    () => membershipPlans.find((plan) => plan.id === selectedPlanId) ?? null,
    [membershipPlans, selectedPlanId]
  );

  async function loadMembershipPlans() {
    const response = await fetch(
      `${apiBaseUrl}/media-ingestion/membership-plans?page=1&pageSize=20`,
      {
        method: "GET"
      }
    );
    const data = (await response.json()) as { items?: MembershipPlanItem[] };

    if (!response.ok) {
      throw new Error("会员方案加载失败");
    }

    const plans = data.items ?? [];
    setMembershipPlans(plans);
    if (!selectedPlanId && plans[0]?.id) {
      setSelectedPlanId(plans[0].id);
    }
  }

  async function loadOrders(currentViewerKey: string) {
    if (!currentViewerKey.trim()) {
      setOrders([]);
      return;
    }

    setOrdersLoading(true);

    try {
      const params = new URLSearchParams({
        page: "1",
        pageSize: "20",
        viewerKey: currentViewerKey.trim()
      });
      const response = await fetch(`${apiBaseUrl}/media-ingestion/orders?${params.toString()}`);
      const data = (await response.json()) as { items?: ViewerOrderItem[]; message?: string };

      if (!response.ok) {
        throw new Error(data.message ?? "订单列表加载失败");
      }

      setOrders(data.items ?? []);
    } finally {
      setOrdersLoading(false);
    }
  }

  async function authorizePlayback(forceRefresh = false) {
    if (!cloudVid.trim()) {
      setMessage("请先输入 cloudVid");
      return;
    }

    setLoading(true);
    setMessage("正在请求播放授权...");

    try {
      const response = await fetch(`${apiBaseUrl}/media-ingestion/playback-authorize`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          cloudVid: cloudVid.trim(),
          viewerKey: viewerKey.trim() || undefined,
          ttl: Number(ttl || 3600),
          domain: "primary",
          forceRefresh
        })
      });
      const data = (await response.json()) as PlaybackAuthorizeResponse & {
        message?: string;
      };

      if (!response.ok) {
        throw new Error(data.message ?? "播放授权失败");
      }

      setResult(data);
      setMessage(
        `授权成功，来源：${data.source}，URL 过期时间：${formatUnix(data.expiresAt)}`
      );
    } catch (error) {
      setResult(null);
      setMessage(error instanceof Error ? error.message : "播放授权失败");
    } finally {
      setLoading(false);
    }
  }

  async function createMembershipOrder() {
    if (!viewerKey.trim()) {
      setMessage("请先输入 viewerKey");
      return;
    }

    if (!selectedPlanId) {
      setMessage("请先选择会员方案");
      return;
    }

    setCreatingMembershipOrder(true);
    setMessage("正在创建会员订单...");

    try {
      const response = await fetch(`${apiBaseUrl}/media-ingestion/orders/membership`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          viewerKey: viewerKey.trim(),
          membershipPlanId: selectedPlanId
        })
      });
      const data = (await response.json()) as { orderNo?: string; message?: string };

      if (!response.ok) {
        throw new Error(data.message ?? "会员订单创建失败");
      }

      setLatestOrderNo(data.orderNo ?? "");
      await loadOrders(viewerKey);
      setMessage(`会员订单已创建：${data.orderNo ?? "-"}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "会员订单创建失败");
    } finally {
      setCreatingMembershipOrder(false);
    }
  }

  async function createContentOrder() {
    if (!viewerKey.trim()) {
      setMessage("请先输入 viewerKey");
      return;
    }

    if (!cloudVid.trim()) {
      setMessage("请先输入 cloudVid");
      return;
    }

    setCreatingContentOrder(true);
    setMessage("正在创建内容订单...");

    try {
      const response = await fetch(`${apiBaseUrl}/media-ingestion/orders/content`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          viewerKey: viewerKey.trim(),
          cloudVid: cloudVid.trim()
        })
      });
      const data = (await response.json()) as { orderNo?: string; message?: string };

      if (!response.ok) {
        throw new Error(data.message ?? "内容订单创建失败");
      }

      setLatestOrderNo(data.orderNo ?? "");
      await loadOrders(viewerKey);
      setMessage(`内容订单已创建：${data.orderNo ?? "-"}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "内容订单创建失败");
    } finally {
      setCreatingContentOrder(false);
    }
  }

  async function completeLatestOrder() {
    if (!latestOrderNo.trim()) {
      setMessage("暂无可完成的订单号");
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
        throw new Error(data.message ?? "订单支付完成处理失败");
      }

      await loadOrders(viewerKey);
      setMessage(`订单已完成支付：${latestOrderNo}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "订单支付完成处理失败");
    } finally {
      setCompletingOrder(false);
    }
  }

  useEffect(() => {
    const video = videoRef.current;
    const source = currentSource;

    if (!video || !source) {
      return;
    }

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = source;
      return;
    }

    if (Hls.isSupported()) {
      hlsRef.current?.destroy();
      const hls = new Hls();
      hls.loadSource(source);
      hls.attachMedia(video);
      hlsRef.current = hls;

      return () => {
        hls.destroy();
        hlsRef.current = null;
      };
    }

    setMessage("当前浏览器不支持 HLS 播放");
  }, [currentSource]);

  useEffect(() => {
    void loadMembershipPlans().catch((error) => {
      setMessage(error instanceof Error ? error.message : "会员方案加载失败");
    });
  }, []);

  useEffect(() => {
    void loadOrders(viewerKey).catch((error) => {
      setMessage(error instanceof Error ? error.message : "订单列表加载失败");
    });
  }, [viewerKey]);

  useEffect(() => {
    return () => {
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  }, []);

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <section
        style={{
          padding: 20,
          borderRadius: 16,
          background: "#fff",
          boxShadow: "0 10px 30px rgba(15, 23, 42, 0.06)"
        }}
      >
        <h1 style={{ marginTop: 0 }}>播放测试页</h1>
        <p style={{ color: "#4b5563", lineHeight: 1.7 }}>
          此页面用于验证最小播放链路：输入已入库的 `cloudVid`，前台调用
          `playback-authorize`，成功后尝试播放返回的 HLS 地址。
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 240px 180px",
            gap: 12
          }}
        >
          <label style={{ display: "grid", gap: 6 }}>
            <span>cloudVid</span>
            <input
              value={cloudVid}
              onChange={(event) => setCloudVid(event.target.value)}
              placeholder="AbCdEf1234"
              style={{ padding: 10, borderRadius: 10, border: "1px solid #d1d5db" }}
            />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span>viewerKey</span>
            <input
              value={viewerKey}
              onChange={(event) => setViewerKey(event.target.value)}
              placeholder="viewer-demo-001"
              style={{ padding: 10, borderRadius: 10, border: "1px solid #d1d5db" }}
            />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span>TTL（秒）</span>
            <input
              value={ttl}
              onChange={(event) => setTtl(event.target.value)}
              style={{ padding: 10, borderRadius: 10, border: "1px solid #d1d5db" }}
            />
          </label>
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
          <button type="button" onClick={() => void authorizePlayback(false)} style={buttonStyle}>
            {loading ? "请求中..." : "请求播放授权"}
          </button>
          <button
            type="button"
            onClick={() => void authorizePlayback(true)}
            style={{ ...buttonStyle, background: "#fff", color: "#111827", border: "1px solid #d1d5db" }}
          >
            强制刷新播放地址
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

      <section
        style={{
          padding: 20,
          borderRadius: 16,
          background: "#fff",
          boxShadow: "0 10px 30px rgba(15, 23, 42, 0.06)"
        }}
      >
        <h2 style={{ marginTop: 0 }}>下单与支付测试</h2>
        <p style={{ color: "#4b5563", lineHeight: 1.7 }}>
          这里把会员下单、内容下单、手动支付完成接到前台，用于验证“未支付不可播，支付后可播”的完整链路。
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12
          }}
        >
          <label style={{ display: "grid", gap: 6 }}>
            <span>会员方案</span>
            <select
              value={selectedPlanId}
              onChange={(event) => setSelectedPlanId(event.target.value)}
              style={{ padding: 10, borderRadius: 10, border: "1px solid #d1d5db" }}
            >
              <option value="">请选择会员方案</option>
              {membershipPlans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name} / {plan.durationDays} 天 / ￥{(plan.priceCents / 100).toFixed(2)}
                </option>
              ))}
            </select>
          </label>
          <div
            style={{
              padding: 12,
              borderRadius: 12,
              background: "#f8fafc",
              color: "#334155",
              lineHeight: 1.8
            }}
          >
            <div>当前 cloudVid：{cloudVid || "-"}</div>
            <div>当前 viewerKey：{viewerKey || "-"}</div>
            <div>选中方案：{selectedPlan ? selectedPlan.name : "-"}</div>
            <div>最近订单号：{latestOrderNo || "-"}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => void createMembershipOrder()}
            style={buttonStyle}
          >
            {creatingMembershipOrder ? "创建中..." : "创建会员订单"}
          </button>
          <button
            type="button"
            onClick={() => void createContentOrder()}
            style={{ ...buttonStyle, background: "#7c3aed" }}
          >
            {creatingContentOrder ? "创建中..." : "创建内容订单"}
          </button>
          <button
            type="button"
            onClick={() => void completeLatestOrder()}
            style={{ ...buttonStyle, background: "#059669" }}
          >
            {completingOrder ? "处理中..." : "模拟支付完成"}
          </button>
          <button
            type="button"
            onClick={() => void loadOrders(viewerKey)}
            style={{ ...buttonStyle, background: "#fff", color: "#111827", border: "1px solid #d1d5db" }}
          >
            {ordersLoading ? "刷新中..." : "刷新订单列表"}
          </button>
        </div>
        <div style={{ marginTop: 16, color: "#4b5563", lineHeight: 1.8 }}>
          <div>建议流程：先配置内容为 VIP 或 PAID，再创建订单并完成支付，最后重新请求播放授权。</div>
        </div>
        <div style={{ marginTop: 16, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>
                <th style={tableCell}>订单号</th>
                <th style={tableCell}>类型</th>
                <th style={tableCell}>状态</th>
                <th style={tableCell}>金额</th>
                <th style={tableCell}>关联对象</th>
                <th style={tableCell}>创建时间</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={6} style={tableCell}>
                    {viewerKey ? "暂无订单记录" : "请输入 viewerKey 查看订单"}
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={tableCell}>{order.orderNo}</td>
                    <td style={tableCell}>{order.orderType}</td>
                    <td style={tableCell}>{order.status}</td>
                    <td style={tableCell}>￥{(order.amountCents / 100).toFixed(2)}</td>
                    <td style={tableCell}>
                      {order.membershipPlan?.name ?? order.contentItem?.title ?? order.contentItem?.cloudVid ?? "-"}
                    </td>
                    <td style={tableCell}>{new Date(order.createdAt).toLocaleString("zh-CN")}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section
        style={{
          padding: 20,
          borderRadius: 16,
          background: "#fff",
          boxShadow: "0 10px 30px rgba(15, 23, 42, 0.06)"
        }}
      >
        <h2 style={{ marginTop: 0 }}>播放器</h2>
        <video
          ref={videoRef}
          controls
          playsInline
          poster={result?.staticCoverUrl}
          style={{
            width: "100%",
            maxWidth: 960,
            borderRadius: 16,
            background: "#000"
          }}
        />
        <div style={{ marginTop: 16, color: "#4b5563", lineHeight: 1.8 }}>
          <div>标题：{result?.title ?? "-"}</div>
          <div>viewerKey：{viewerKey || "-"}</div>
          <div>访问类型：{result?.accessType ?? "-"}</div>
          <div>内容是否已配置：{String(result?.contentConfigured ?? false)}</div>
          <div>播放地址来源：{result?.source ?? "-"}</div>
          <div>URL 过期时间：{result ? formatUnix(result.expiresAt) : "-"}</div>
          <div>主地址：{result?.resourceUrl ?? "-"}</div>
          <div>备用地址：{result?.resourceUrl2 ?? "-"}</div>
        </div>
      </section>
    </div>
  );
}

const buttonStyle: CSSProperties = {
  padding: "10px 16px",
  borderRadius: 10,
  border: "none",
  background: "#2563eb",
  color: "#fff",
  cursor: "pointer"
};

const tableCell: CSSProperties = {
  padding: "12px 8px"
};
