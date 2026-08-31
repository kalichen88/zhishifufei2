// 本地联调用云转码 mock 服务
// 用法: node scripts/mock-cloud-api.mjs  (默认端口 9800)
import { createHmac } from "node:crypto";
import { createServer } from "node:http";

const PORT = Number(process.env.MOCK_CLOUD_PORT ?? 9800);
const RESOURCE_KEY = process.env.YZM_RESOURCE_API_KEY ?? "local-dev-key";

const nowUnix = () => Math.floor(Date.now() / 1000);

const resources = new Map(
  [
    {
      id: 1,
      vid: "test-vid-001",
      title: "测试课程一",
      status: 0,
      available: true,
      deleted: false,
      duration: 300,
      size: 10240000,
      category: "课程",
      sourceMd5: "md5-001",
      hasStaticCover: true,
      hasGifCover: false,
      createdAt: 1756600000,
      updatedAt: 1756600000
    },
    {
      id: 2,
      vid: "test-vid-002",
      title: "测试课程二",
      status: 0,
      available: true,
      deleted: false,
      duration: 420,
      size: 20480000,
      category: "课程",
      sourceMd5: "md5-002",
      hasStaticCover: true,
      hasGifCover: false,
      createdAt: 1756600001,
      updatedAt: 1756600001
    }
  ].map((item) => [item.vid, item])
);

const json = (res, status, payload) => {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://127.0.0.1:${PORT}`);

  if (url.pathname !== "/api/v1/open/resources" && url.pathname !== "/api/v1/open/resources/renew") {
    json(res, 404, { code: 404, msg: "not-found" });
    return;
  }

  // 校验签名（与正式云转码规则一致）
  const key = url.searchParams.get("key");
  const ts = Number(url.searchParams.get("ts"));
  const sign = url.searchParams.get("sign");
  if (key !== RESOURCE_KEY) {
    json(res, 401, { code: 401, msg: "invalid-key" });
    return;
  }
  if (req.method === "GET") {
    const expected = createHmac("sha256", RESOURCE_KEY).update(`${ts}|`).digest("hex");
    if (sign !== expected) {
      json(res, 401, { code: 401, msg: "invalid-sign" });
      return;
    }
    const updatedAfter = Number(url.searchParams.get("updated_after") ?? 0);
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
    const pageSize = Math.max(1, Number(url.searchParams.get("pageSize") ?? 100));
    const includeDeleted = url.searchParams.get("include_deleted") === "1";
    const list = [...resources.values()]
      .filter((item) => item.updatedAt > updatedAfter)
      .filter((item) => includeDeleted || !item.deleted);
    const start = (page - 1) * pageSize;
    const paged = list.slice(start, start + pageSize);
    json(res, 200, {
      code: 0,
      msg: "ok",
      data: {
        total: list.length,
        page,
        pageSize,
        hasMore: start + pageSize < list.length,
        list: paged
      }
    });
    return;
  }

  if (req.method === "POST") {
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const rawBody = Buffer.concat(chunks).toString("utf8");
    const expected = createHmac("sha256", RESOURCE_KEY).update(`${ts}|${rawBody}`).digest("hex");
    if (sign !== expected) {
      json(res, 401, { code: 401, msg: "invalid-sign" });
      return;
    }
    const body = JSON.parse(rawBody || "{}");
    const ttl = Math.max(60, Number(body.ttl ?? 3600));
    const domain = body.domain === "per-video" ? "per-video" : "primary";
    const expiresAt = nowUnix() + ttl;
    const rows = [];
    for (const vid of body.vids ?? []) {
      const item = resources.get(vid);
      if (!item || item.deleted) {
        continue;
      }
      const prefix = domain === "per-video" ? "https://per-video.mock-cdn.local" : "https://primary.mock-cdn.local";
      rows.push({
        vid,
        title: item.title,
        status: item.status,
        available: item.available,
        staticCoverUrl: item.hasStaticCover ? `${prefix}/cover/${vid}.jpg` : undefined,
        hasStaticCover: item.hasStaticCover,
        gifCoverUrl: item.hasGifCover ? `${prefix}/gif/${vid}.gif` : undefined,
        hasGifCover: item.hasGifCover,
        resourceUrl: `${prefix}/m3u8/${vid}/index.m3u8?sign=mock&expires=${expiresAt}`,
        resourceUrl2: `${prefix}/mp4/${vid}.mp4?sign=mock&expires=${expiresAt}`,
        playUrl: `${prefix}/play/${vid}`,
        expiresAt
      });
    }
    json(res, 200, { code: 0, msg: "ok", data: { count: rows.length, rows } });
    return;
  }

  json(res, 405, { code: 405, msg: "method-not-allowed" });
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[mock-cloud-api] listening on http://127.0.0.1:${PORT}`);
});
