"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";

import { adminFetch } from "../admin-session";

type AssetItem = {
  id: string;
  cloudVid: string;
  title: string;
  categoryName: string;
  cloudSyncState: "ACTIVE" | "OFFLINE" | "DELETED";
  publishState: "DRAFT" | "REVIEWING" | "PUBLISHED" | "UNPUBLISHED";
  cloudUpdatedAt: number;
  urlExpiresAt: number;
};

type AssetListResponse = {
  items: AssetItem[];
  total: number;
  page: number;
  pageSize: number;
  cursor?: {
    lastUpdatedAfter: number;
  } | null;
};

type WebhookEventItem = {
  id: string;
  eventType: string;
  eventKey: string;
  cloudVid: string;
  processState: string;
  processNote?: string | null;
  receivedAt: string;
};

type ImportBatchItem = {
  id: string;
  sourceName: string;
  status: string;
  totalRows: number;
  successRows: number;
  failedRows: number;
  createdAt: string;
};

type ContentConfigItem = {
  id: string;
  cloudVid: string;
  title: string;
  accessType: "FREE" | "VIP" | "PAID";
  publishState: "DRAFT" | "REVIEWING" | "PUBLISHED" | "UNPUBLISHED";
  previewDurationSec: number;
  priceCents: number;
  updatedAt: string;
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
  viewerAccount?: {
    viewerKey: string;
  };
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

const demoCsv = [
  "id,vid,title,status,available,deleted,duration,size,category,sourceMd5,hasStaticCover,hasGifCover,createdAt,updatedAt",
  "101,DemoVid001,演示资源 A,1,true,false,123.45,104857600,课程,md5-demo-a,true,true,1756600000,1756601234",
  "102,DemoVid002,演示资源 B,1,true,false,88.88,73400320,训练营,md5-demo-b,true,false,1756601000,1756602234"
].join("\n");

function formatUnix(unix: number) {
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

function statusColor(status: AssetItem["cloudSyncState"]) {
  if (status === "ACTIVE") {
    return "#16a34a";
  }

  if (status === "OFFLINE") {
    return "#d97706";
  }

  return "#dc2626";
}

const sectionCardStyle: CSSProperties = {
  padding: 20,
  background: "#fff",
  borderRadius: 16,
  boxShadow: "0 10px 30px rgba(15, 23, 42, 0.06)"
};

export function ResourceCenter() {
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [webhookEvents, setWebhookEvents] = useState<WebhookEventItem[]>([]);
  const [importBatches, setImportBatches] = useState<ImportBatchItem[]>([]);
  const [contentConfigs, setContentConfigs] = useState<ContentConfigItem[]>([]);
  const [membershipPlans, setMembershipPlans] = useState<MembershipPlanItem[]>([]);
  const [viewerOrders, setViewerOrders] = useState<ViewerOrderItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [renewing, setRenewing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [savingContentConfig, setSavingContentConfig] = useState(false);
  const [savingMembershipPlan, setSavingMembershipPlan] = useState(false);
  const [grantingMembership, setGrantingMembership] = useState(false);
  const [grantingPurchase, setGrantingPurchase] = useState(false);
  const [creatingMembershipOrder, setCreatingMembershipOrder] = useState(false);
  const [creatingContentOrder, setCreatingContentOrder] = useState(false);
  const [completingOrder, setCompletingOrder] = useState(false);
  const [message, setMessage] = useState("准备就绪");
  const [updatedAfter, setUpdatedAfter] = useState("0");
  const [pageSize, setPageSize] = useState("20");
  const [renewVid, setRenewVid] = useState("");
  const [renewTtl, setRenewTtl] = useState("3600");
  const [cursor, setCursor] = useState<number>(0);
  const [csvSourceName, setCsvSourceName] = useState("manual-demo-import");
  const [csvContent, setCsvContent] = useState(demoCsv);
  const [contentCloudVid, setContentCloudVid] = useState("");
  const [contentTitle, setContentTitle] = useState("");
  const [contentAccessType, setContentAccessType] = useState<"FREE" | "VIP" | "PAID">("FREE");
  const [contentPublishState, setContentPublishState] =
    useState<"DRAFT" | "REVIEWING" | "PUBLISHED" | "UNPUBLISHED">("PUBLISHED");
  const [contentPriceCents, setContentPriceCents] = useState("0");
  const [viewerKey, setViewerKey] = useState("viewer-demo-001");
  const [viewerDisplayName, setViewerDisplayName] = useState("演示用户");
  const [membershipExpiresAtUnix, setMembershipExpiresAtUnix] = useState(
    String(Math.floor(Date.now() / 1000) + 7 * 24 * 3600)
  );
  const [purchaseCloudVid, setPurchaseCloudVid] = useState("");
  const [planName, setPlanName] = useState("月卡会员");
  const [planDurationDays, setPlanDurationDays] = useState("30");
  const [planPriceCents, setPlanPriceCents] = useState("1999");
  const [membershipPlanId, setMembershipPlanId] = useState("");
  const [completeOrderNo, setCompleteOrderNo] = useState("");

  const listUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", "1");
    params.set("pageSize", pageSize);
    return `${apiBaseUrl}/media-ingestion/assets?${params.toString()}`;
  }, [pageSize]);

  async function loadAssets() {
    setLoading(true);
    setMessage("正在加载资源列表...");

    try {
      const response = await adminFetch(listUrl, {
        method: "GET"
      });
      const data = (await response.json()) as AssetListResponse;

      if (!response.ok) {
        throw new Error("资源列表加载失败");
      }

      setAssets(data.items ?? []);
      setCursor(data.cursor?.lastUpdatedAfter ?? 0);
      setMessage(`已加载 ${data.items?.length ?? 0} 条资源记录`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "资源列表加载失败");
    } finally {
      setLoading(false);
    }
  }

  async function loadWebhookEvents() {
    const response = await adminFetch(
      `${apiBaseUrl}/media-ingestion/webhook-events?page=1&pageSize=10`
    );
    const data = (await response.json()) as { items?: WebhookEventItem[] };

    if (response.ok) {
      setWebhookEvents(data.items ?? []);
    }
  }

  async function loadImportBatches() {
    const response = await adminFetch(
      `${apiBaseUrl}/media-ingestion/import-batches?page=1&pageSize=10`
    );
    const data = (await response.json()) as { items?: ImportBatchItem[] };

    if (response.ok) {
      setImportBatches(data.items ?? []);
    }
  }

  async function loadContentConfigs() {
    const response = await adminFetch(
      `${apiBaseUrl}/media-ingestion/content-configs?page=1&pageSize=20`
    );
    const data = (await response.json()) as { items?: ContentConfigItem[] };

    if (response.ok) {
      setContentConfigs(data.items ?? []);
    }
  }

  async function loadMembershipPlans() {
    const response = await adminFetch(
      `${apiBaseUrl}/media-ingestion/membership-plans?page=1&pageSize=20`
    );
    const data = (await response.json()) as { items?: MembershipPlanItem[] };

    if (response.ok) {
      const plans = data.items ?? [];
      setMembershipPlans(plans);
      if (!membershipPlanId && plans[0]?.id) {
        setMembershipPlanId(plans[0].id);
      }
    }
  }

  async function loadViewerOrders() {
    const params = new URLSearchParams();
    params.set("page", "1");
    params.set("pageSize", "20");
    if (viewerKey.trim()) {
      params.set("viewerKey", viewerKey.trim());
    }

    const response = await adminFetch(`${apiBaseUrl}/media-ingestion/orders?${params.toString()}`);
    const data = (await response.json()) as { items?: ViewerOrderItem[] };

    if (response.ok) {
      setViewerOrders(data.items ?? []);
    }
  }

  async function syncRemote() {
    setSyncing(true);
    setMessage("正在执行远端同步...");

    try {
      const response = await adminFetch(`${apiBaseUrl}/media-ingestion/sync-remote`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          updatedAfter: Number(updatedAfter || 0),
          page: 1,
          pageSize: 100,
          includeDeleted: true,
          persist: true
        })
      });
      const data = (await response.json()) as {
        remote?: { list?: unknown[] };
        persisted?: { upserted?: number; nextUpdatedAfter?: number } | null;
      };

      if (!response.ok) {
        throw new Error("远端同步失败");
      }

      setCursor(data.persisted?.nextUpdatedAfter ?? 0);
      setUpdatedAfter(String(data.persisted?.nextUpdatedAfter ?? 0));
      setMessage(
        `远端同步完成，本次拉取 ${data.remote?.list?.length ?? 0} 条，入库 ${data.persisted?.upserted ?? 0} 条`
      );
      await Promise.all([loadAssets(), loadWebhookEvents(), loadImportBatches()]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "远端同步失败");
    } finally {
      setSyncing(false);
    }
  }

  async function renewSingleVid() {
    if (!renewVid.trim()) {
      setMessage("请先输入要续签的 cloud vid");
      return;
    }

    setRenewing(true);
    setMessage("正在刷新签名 URL...");

    try {
      const response = await adminFetch(`${apiBaseUrl}/media-ingestion/renew-remote`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          vids: [renewVid.trim()],
          ttl: Number(renewTtl || 3600),
          domain: "primary",
          persist: true
        })
      });
      const data = (await response.json()) as {
        rows?: Array<{ vid: string; expiresAt: number }>;
      };

      if (!response.ok) {
        throw new Error("续签失败");
      }

      const first = data.rows?.[0];
      setMessage(
        first
          ? `续签成功：${first.vid}，过期时间 ${formatUnix(first.expiresAt)}`
          : "续签完成，但未返回可用 URL"
      );
      await loadAssets();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "续签失败");
    } finally {
      setRenewing(false);
    }
  }

  async function importCsv() {
    if (!csvContent.trim()) {
      setMessage("CSV 内容不能为空");
      return;
    }

    setImporting(true);
    setMessage("正在执行 CSV 导入...");

    try {
      const response = await adminFetch(`${apiBaseUrl}/media-ingestion/import-csv`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sourceName: csvSourceName,
          csvContent
        })
      });
      const data = (await response.json()) as { imported?: number; batchId?: string };

      if (!response.ok) {
        throw new Error("CSV 导入失败");
      }

      setMessage(`CSV 导入完成，导入 ${data.imported ?? 0} 条，批次 ${data.batchId ?? "-"}`);
      await Promise.all([loadAssets(), loadImportBatches()]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "CSV 导入失败");
    } finally {
      setImporting(false);
    }
  }

  async function saveContentConfig() {
    if (!contentCloudVid.trim() || !contentTitle.trim()) {
      setMessage("请先填写内容 cloudVid 和标题");
      return;
    }

    setSavingContentConfig(true);
    setMessage("正在保存内容访问配置...");

    try {
      const response = await adminFetch(`${apiBaseUrl}/media-ingestion/content-config`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          cloudVid: contentCloudVid.trim(),
          title: contentTitle.trim(),
          accessType: contentAccessType,
          publishState: contentPublishState,
          priceCents: Number(contentPriceCents || 0)
        })
      });

      if (!response.ok) {
        throw new Error("内容访问配置保存失败");
      }

      setMessage("内容访问配置已保存");
      await loadContentConfigs();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "内容访问配置保存失败");
    } finally {
      setSavingContentConfig(false);
    }
  }

  async function grantVipMembership() {
    if (!viewerKey.trim()) {
      setMessage("请先填写 viewerKey");
      return;
    }

    setGrantingMembership(true);
    setMessage("正在发放 VIP 授权...");

    try {
      const response = await adminFetch(`${apiBaseUrl}/media-ingestion/grant-membership`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          viewerKey: viewerKey.trim(),
          displayName: viewerDisplayName.trim(),
          expiresAtUnix: Number(membershipExpiresAtUnix || 0)
        })
      });

      if (!response.ok) {
        throw new Error("VIP 授权发放失败");
      }

      setMessage("VIP 授权已发放");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "VIP 授权发放失败");
    } finally {
      setGrantingMembership(false);
    }
  }

  async function grantPurchaseAccess() {
    if (!viewerKey.trim() || !purchaseCloudVid.trim()) {
      setMessage("请先填写 viewerKey 和购买的 cloudVid");
      return;
    }

    setGrantingPurchase(true);
    setMessage("正在发放购买授权...");

    try {
      const response = await adminFetch(`${apiBaseUrl}/media-ingestion/grant-purchase`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          viewerKey: viewerKey.trim(),
          displayName: viewerDisplayName.trim(),
          cloudVid: purchaseCloudVid.trim(),
          source: "admin-manual-grant"
        })
      });

      if (!response.ok) {
        throw new Error("购买授权发放失败");
      }

      setMessage("购买授权已发放");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "购买授权发放失败");
    } finally {
      setGrantingPurchase(false);
    }
  }

  async function saveMembershipPlan() {
    setSavingMembershipPlan(true);
    setMessage("正在保存会员方案...");

    try {
      const response = await adminFetch(`${apiBaseUrl}/media-ingestion/membership-plan`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: planName,
          durationDays: Number(planDurationDays || 30),
          priceCents: Number(planPriceCents || 0),
          isActive: true
        })
      });

      if (!response.ok) {
        throw new Error("会员方案保存失败");
      }

      setMessage("会员方案已保存");
      await loadMembershipPlans();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "会员方案保存失败");
    } finally {
      setSavingMembershipPlan(false);
    }
  }

  async function createMembershipOrderFlow() {
    if (!viewerKey.trim() || !membershipPlanId) {
      setMessage("请先填写 viewerKey 并选择会员方案");
      return;
    }

    setCreatingMembershipOrder(true);
    setMessage("正在创建会员订单...");

    try {
      const response = await adminFetch(`${apiBaseUrl}/media-ingestion/orders/membership`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          viewerKey: viewerKey.trim(),
          displayName: viewerDisplayName.trim(),
          membershipPlanId
        })
      });
      const data = (await response.json()) as { orderNo?: string };

      if (!response.ok) {
        throw new Error("会员订单创建失败");
      }

      setCompleteOrderNo(data.orderNo ?? "");
      setMessage(`会员订单已创建：${data.orderNo ?? "-"}`);
      await loadViewerOrders();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "会员订单创建失败");
    } finally {
      setCreatingMembershipOrder(false);
    }
  }

  async function createContentOrderFlow() {
    if (!viewerKey.trim() || !purchaseCloudVid.trim()) {
      setMessage("请先填写 viewerKey 和要购买的 cloudVid");
      return;
    }

    setCreatingContentOrder(true);
    setMessage("正在创建内容订单...");

    try {
      const response = await adminFetch(`${apiBaseUrl}/media-ingestion/orders/content`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          viewerKey: viewerKey.trim(),
          displayName: viewerDisplayName.trim(),
          cloudVid: purchaseCloudVid.trim()
        })
      });
      const data = (await response.json()) as { orderNo?: string };

      if (!response.ok) {
        throw new Error("内容订单创建失败");
      }

      setCompleteOrderNo(data.orderNo ?? "");
      setMessage(`内容订单已创建：${data.orderNo ?? "-"}`);
      await loadViewerOrders();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "内容订单创建失败");
    } finally {
      setCreatingContentOrder(false);
    }
  }

  async function completeOrderFlow() {
    if (!completeOrderNo.trim()) {
      setMessage("请先填写 orderNo");
      return;
    }

    setCompletingOrder(true);
    setMessage("正在标记订单支付完成...");

    try {
      const response = await adminFetch(`${apiBaseUrl}/media-ingestion/orders/complete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          orderNo: completeOrderNo.trim()
        })
      });

      if (!response.ok) {
        throw new Error("订单支付完成处理失败");
      }

      setMessage(`订单已完成支付：${completeOrderNo}`);
      await Promise.all([loadViewerOrders(), loadContentConfigs()]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "订单支付完成处理失败");
    } finally {
      setCompletingOrder(false);
    }
  }

  useEffect(() => {
    void Promise.all([
      loadAssets(),
      loadWebhookEvents(),
      loadImportBatches(),
      loadContentConfigs(),
      loadMembershipPlans(),
      loadViewerOrders()
    ]);
  }, [listUrl]);

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <section style={sectionCardStyle}>
        <h2 style={{ marginTop: 0 }}>资源接入控制台</h2>
        <p style={{ color: "#4b5563", lineHeight: 1.7 }}>
          这里直接面向资源接入 API，包括资源列表、远端同步、签名 URL 续签、CSV
          导入以及操作日志查看。
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12
          }}
        >
          <label style={{ display: "grid", gap: 6 }}>
            <span>增量游标 updatedAfter</span>
            <input
              value={updatedAfter}
              onChange={(event) => setUpdatedAfter(event.target.value)}
              style={{ padding: 10, borderRadius: 10, border: "1px solid #d1d5db" }}
            />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span>列表 pageSize</span>
            <input
              value={pageSize}
              onChange={(event) => setPageSize(event.target.value)}
              style={{ padding: 10, borderRadius: 10, border: "1px solid #d1d5db" }}
            />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span>续签 cloud vid</span>
            <input
              value={renewVid}
              onChange={(event) => setRenewVid(event.target.value)}
              placeholder="AbCdEf1234"
              style={{ padding: 10, borderRadius: 10, border: "1px solid #d1d5db" }}
            />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span>续签 TTL（秒）</span>
            <input
              value={renewTtl}
              onChange={(event) => setRenewTtl(event.target.value)}
              style={{ padding: 10, borderRadius: 10, border: "1px solid #d1d5db" }}
            />
          </label>
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 16 }}>
          <button
            type="button"
            onClick={() => void loadAssets()}
            disabled={loading}
            style={primaryButton("#2563eb")}
          >
            {loading ? "加载中..." : "刷新列表"}
          </button>
          <button
            type="button"
            onClick={() => void syncRemote()}
            disabled={syncing}
            style={primaryButton("#059669")}
          >
            {syncing ? "同步中..." : "执行远端同步"}
          </button>
          <button
            type="button"
            onClick={() => void renewSingleVid()}
            disabled={renewing}
            style={secondaryButton()}
          >
            {renewing ? "续签中..." : "续签单个资源"}
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
          <br />
          最近同步游标：{cursor || 0}
        </div>
      </section>

      <section style={sectionCardStyle}>
        <h2 style={{ marginTop: 0 }}>CSV 导入</h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "280px 1fr",
            gap: 12
          }}
        >
          <label style={{ display: "grid", gap: 6 }}>
            <span>导入来源名称</span>
            <input
              value={csvSourceName}
              onChange={(event) => setCsvSourceName(event.target.value)}
              style={{ padding: 10, borderRadius: 10, border: "1px solid #d1d5db" }}
            />
          </label>
          <div />
        </div>
        <textarea
          value={csvContent}
          onChange={(event) => setCsvContent(event.target.value)}
          style={{
            width: "100%",
            minHeight: 180,
            marginTop: 12,
            padding: 12,
            borderRadius: 12,
            border: "1px solid #d1d5db",
            fontFamily: "Consolas, monospace"
          }}
        />
        <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
          <button
            type="button"
            onClick={() => void importCsv()}
            disabled={importing}
            style={primaryButton("#7c3aed")}
          >
            {importing ? "导入中..." : "执行 CSV 导入"}
          </button>
          <button
            type="button"
            onClick={() => setCsvContent(demoCsv)}
            style={secondaryButton()}
          >
            填充示例数据
          </button>
        </div>
      </section>

      <section style={sectionCardStyle}>
        <h2 style={{ marginTop: 0 }}>播放权限配置</h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12
          }}
        >
          <label style={{ display: "grid", gap: 6 }}>
            <span>内容 cloudVid</span>
            <input
              value={contentCloudVid}
              onChange={(event) => setContentCloudVid(event.target.value)}
              style={{ padding: 10, borderRadius: 10, border: "1px solid #d1d5db" }}
            />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span>内容标题</span>
            <input
              value={contentTitle}
              onChange={(event) => setContentTitle(event.target.value)}
              style={{ padding: 10, borderRadius: 10, border: "1px solid #d1d5db" }}
            />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span>访问类型</span>
            <select
              value={contentAccessType}
              onChange={(event) =>
                setContentAccessType(event.target.value as "FREE" | "VIP" | "PAID")
              }
              style={{ padding: 10, borderRadius: 10, border: "1px solid #d1d5db" }}
            >
              <option value="FREE">FREE</option>
              <option value="VIP">VIP</option>
              <option value="PAID">PAID</option>
            </select>
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span>发布状态</span>
            <select
              value={contentPublishState}
              onChange={(event) =>
                setContentPublishState(
                  event.target.value as "DRAFT" | "REVIEWING" | "PUBLISHED" | "UNPUBLISHED"
                )
              }
              style={{ padding: 10, borderRadius: 10, border: "1px solid #d1d5db" }}
            >
              <option value="PUBLISHED">PUBLISHED</option>
              <option value="DRAFT">DRAFT</option>
              <option value="REVIEWING">REVIEWING</option>
              <option value="UNPUBLISHED">UNPUBLISHED</option>
            </select>
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span>价格（分）</span>
            <input
              value={contentPriceCents}
              onChange={(event) => setContentPriceCents(event.target.value)}
              style={{ padding: 10, borderRadius: 10, border: "1px solid #d1d5db" }}
            />
          </label>
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
          <button
            type="button"
            onClick={() => void saveContentConfig()}
            disabled={savingContentConfig}
            style={primaryButton("#ea580c")}
          >
            {savingContentConfig ? "保存中..." : "保存内容访问配置"}
          </button>
        </div>

        <div
          style={{
            marginTop: 16,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12
          }}
        >
          <label style={{ display: "grid", gap: 6 }}>
            <span>viewerKey</span>
            <input
              value={viewerKey}
              onChange={(event) => setViewerKey(event.target.value)}
              style={{ padding: 10, borderRadius: 10, border: "1px solid #d1d5db" }}
            />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span>displayName</span>
            <input
              value={viewerDisplayName}
              onChange={(event) => setViewerDisplayName(event.target.value)}
              style={{ padding: 10, borderRadius: 10, border: "1px solid #d1d5db" }}
            />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span>VIP 到期时间戳</span>
            <input
              value={membershipExpiresAtUnix}
              onChange={(event) => setMembershipExpiresAtUnix(event.target.value)}
              style={{ padding: 10, borderRadius: 10, border: "1px solid #d1d5db" }}
            />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span>购买的 cloudVid</span>
            <input
              value={purchaseCloudVid}
              onChange={(event) => setPurchaseCloudVid(event.target.value)}
              style={{ padding: 10, borderRadius: 10, border: "1px solid #d1d5db" }}
            />
          </label>
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => void grantVipMembership()}
            disabled={grantingMembership}
            style={primaryButton("#7c3aed")}
          >
            {grantingMembership ? "发放中..." : "发放 VIP 授权"}
          </button>
          <button
            type="button"
            onClick={() => void grantPurchaseAccess()}
            disabled={grantingPurchase}
            style={secondaryButton()}
          >
            {grantingPurchase ? "发放中..." : "发放购买授权"}
          </button>
        </div>

        <div style={{ marginTop: 16 }}>
          <h3 style={{ marginBottom: 12 }}>内容访问配置列表</h3>
          {contentConfigs.length === 0 ? (
            <p style={{ color: "#6b7280" }}>当前还没有内容访问配置。</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
              {contentConfigs.map((item) => (
                <li key={item.id}>
                  <strong>{item.title}</strong> / {item.cloudVid} / {item.accessType} /{" "}
                  {item.publishState}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section style={sectionCardStyle}>
        <h2 style={{ marginTop: 0 }}>会员方案与订单</h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12
          }}
        >
          <label style={{ display: "grid", gap: 6 }}>
            <span>会员方案名称</span>
            <input
              value={planName}
              onChange={(event) => setPlanName(event.target.value)}
              style={{ padding: 10, borderRadius: 10, border: "1px solid #d1d5db" }}
            />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span>时长（天）</span>
            <input
              value={planDurationDays}
              onChange={(event) => setPlanDurationDays(event.target.value)}
              style={{ padding: 10, borderRadius: 10, border: "1px solid #d1d5db" }}
            />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span>价格（分）</span>
            <input
              value={planPriceCents}
              onChange={(event) => setPlanPriceCents(event.target.value)}
              style={{ padding: 10, borderRadius: 10, border: "1px solid #d1d5db" }}
            />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span>选中的会员方案</span>
            <select
              value={membershipPlanId}
              onChange={(event) => setMembershipPlanId(event.target.value)}
              style={{ padding: 10, borderRadius: 10, border: "1px solid #d1d5db" }}
            >
              <option value="">请选择方案</option>
              {membershipPlans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name} / {plan.durationDays} 天 / {plan.priceCents} 分
                </option>
              ))}
            </select>
          </label>
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => void saveMembershipPlan()}
            disabled={savingMembershipPlan}
            style={primaryButton("#0f766e")}
          >
            {savingMembershipPlan ? "保存中..." : "保存会员方案"}
          </button>
          <button
            type="button"
            onClick={() => void createMembershipOrderFlow()}
            disabled={creatingMembershipOrder}
            style={primaryButton("#2563eb")}
          >
            {creatingMembershipOrder ? "创建中..." : "创建会员订单"}
          </button>
          <button
            type="button"
            onClick={() => void createContentOrderFlow()}
            disabled={creatingContentOrder}
            style={secondaryButton()}
          >
            {creatingContentOrder ? "创建中..." : "创建内容订单"}
          </button>
        </div>

        <div
          style={{
            marginTop: 16,
            display: "grid",
            gridTemplateColumns: "280px 180px",
            gap: 12
          }}
        >
          <label style={{ display: "grid", gap: 6 }}>
            <span>待完成支付的 orderNo</span>
            <input
              value={completeOrderNo}
              onChange={(event) => setCompleteOrderNo(event.target.value)}
              style={{ padding: 10, borderRadius: 10, border: "1px solid #d1d5db" }}
            />
          </label>
          <div style={{ display: "flex", alignItems: "end" }}>
            <button
              type="button"
              onClick={() => void completeOrderFlow()}
              disabled={completingOrder}
              style={primaryButton("#dc2626")}
            >
              {completingOrder ? "处理中..." : "标记支付完成"}
            </button>
          </div>
        </div>

        <div
          style={{
            marginTop: 16,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: 20
          }}
        >
          <div>
            <h3 style={{ marginBottom: 12 }}>会员方案列表</h3>
            {membershipPlans.length === 0 ? (
              <p style={{ color: "#6b7280" }}>当前还没有会员方案。</p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
                {membershipPlans.map((plan) => (
                  <li key={plan.id}>
                    <strong>{plan.name}</strong> / {plan.durationDays} 天 / {plan.priceCents} 分 /{" "}
                    {plan.isActive ? "启用" : "停用"}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h3 style={{ marginBottom: 12 }}>订单列表</h3>
            {viewerOrders.length === 0 ? (
              <p style={{ color: "#6b7280" }}>当前还没有订单。</p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
                {viewerOrders.map((order) => (
                  <li key={order.id}>
                    <strong>{order.orderNo}</strong> / {order.orderType} / {order.status}
                    <br />
                    <span style={{ color: "#6b7280" }}>
                      用户 {order.viewerAccount?.viewerKey ?? "-"} / 金额 {order.amountCents} 分 /{" "}
                      {order.membershipPlan?.name ?? order.contentItem?.title ?? "-"} /{" "}
                      {formatIso(order.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      <section style={sectionCardStyle}>
        <h2 style={{ marginTop: 0 }}>资源列表</h2>
        <div style={{ overflowX: "auto" }}>
          <table style={tableStyle}>
            <thead>
              <tr style={tableHeaderRow}>
                <th style={tableCell}>cloudVid</th>
                <th style={tableCell}>标题</th>
                <th style={tableCell}>分类</th>
                <th style={tableCell}>同步状态</th>
                <th style={tableCell}>发布状态</th>
                <th style={tableCell}>最近更新</th>
                <th style={tableCell}>URL 过期时间</th>
              </tr>
            </thead>
            <tbody>
              {assets.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ ...tableCell, padding: 20, color: "#6b7280" }}>
                    暂无资源记录。可以先执行一次远端同步或 CSV 导入。
                  </td>
                </tr>
              ) : (
                assets.map((item) => (
                  <tr key={item.id} style={tableBodyRow}>
                    <td style={{ ...tableCell, fontFamily: "monospace" }}>{item.cloudVid}</td>
                    <td style={tableCell}>{item.title}</td>
                    <td style={tableCell}>{item.categoryName || "-"}</td>
                    <td style={{ ...tableCell, color: statusColor(item.cloudSyncState) }}>
                      {item.cloudSyncState}
                    </td>
                    <td style={tableCell}>{item.publishState}</td>
                    <td style={tableCell}>{formatUnix(item.cloudUpdatedAt)}</td>
                    <td style={tableCell}>{formatUnix(item.urlExpiresAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 20
        }}
      >
        <section style={sectionCardStyle}>
          <h2 style={{ marginTop: 0 }}>Webhook 日志</h2>
          {webhookEvents.length === 0 ? (
            <p style={{ color: "#6b7280" }}>当前还没有 Webhook 记录。</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
              {webhookEvents.map((item) => (
                <li key={item.id}>
                  <strong>{item.eventType}</strong> / {item.cloudVid} / {item.processState}
                  <br />
                  <span style={{ color: "#6b7280" }}>
                    {formatIso(item.receivedAt)}{item.processNote ? ` / ${item.processNote}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section style={sectionCardStyle}>
          <h2 style={{ marginTop: 0 }}>导入批次</h2>
          {importBatches.length === 0 ? (
            <p style={{ color: "#6b7280" }}>当前还没有导入批次。</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
              {importBatches.map((item) => (
                <li key={item.id}>
                  <strong>{item.sourceName}</strong> / {item.status}
                  <br />
                  <span style={{ color: "#6b7280" }}>
                    总数 {item.totalRows} / 成功 {item.successRows} / 失败 {item.failedRows} /{" "}
                    {formatIso(item.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function primaryButton(background: string): CSSProperties {
  return {
    padding: "10px 16px",
    borderRadius: 10,
    border: "none",
    background,
    color: "#fff",
    cursor: "pointer"
  };
}

function secondaryButton(): CSSProperties {
  return {
    padding: "10px 16px",
    borderRadius: 10,
    border: "1px solid #d1d5db",
    background: "#fff",
    color: "#111827",
    cursor: "pointer"
  };
}

const tableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse"
};

const tableHeaderRow: CSSProperties = {
  textAlign: "left",
  borderBottom: "1px solid #e5e7eb"
};

const tableBodyRow: CSSProperties = {
  borderBottom: "1px solid #f3f4f6",
  verticalAlign: "top"
};

const tableCell: CSSProperties = {
  padding: "12px 8px"
};
