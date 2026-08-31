// 本地联调用彩虹易支付 mock 网关
// 用法: node scripts/mock-epay.mjs  (默认端口 9801)
import { createHash } from "node:crypto";
import { createServer } from "node:http";

const PORT = Number(process.env.MOCK_EPAY_PORT ?? 9801);
const PID = process.env.EPAY_PID ?? "1000";
const KEY = process.env.EPAY_KEY ?? "local-dev-epay-key";

const md5 = (value) => createHash("md5").update(value, "utf8").digest("hex");

const signString = (params) =>
  Object.keys(params)
    .filter((key) => key !== "sign" && key !== "sign_type" && String(params[key] ?? "") !== "")
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");

const json = (res, status, payload) => {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://127.0.0.1:${PORT}`);

  if (url.pathname !== "/submit.php") {
    json(res, 404, { code: 404, msg: "not-found" });
    return;
  }

  const params = Object.fromEntries(url.searchParams.entries());

  if (String(params.pid) !== String(PID)) {
    json(res, 401, { code: 401, msg: "invalid-pid" });
    return;
  }

  const expectedSign = md5(`${signString(params)}${KEY}`);

  if (expectedSign.toLowerCase() !== String(params.sign ?? "").toLowerCase()) {
    json(res, 401, { code: 401, msg: "invalid-sign", expectedSign });
    return;
  }

  // 模拟支付成功：立即携带正确签名回调 notify_url
  const notifyUrl = new URL(params.notify_url);
  const notifyParams = {
    pid: params.pid,
    name: params.name,
    money: params.money,
    out_trade_no: params.out_trade_no,
    trade_no: `MOCK${Date.now()}`,
    type: params.type,
    trade_status: "TRADE_SUCCESS"
  };
  notifyParams.sign = md5(`${signString(notifyParams)}${KEY}`);
  notifyParams.sign_type = "MD5";
  for (const [key, value] of Object.entries(notifyParams)) {
    notifyUrl.searchParams.set(key, value);
  }

  let notifyStatus = "fail";
  try {
    const notifyResponse = await fetch(notifyUrl, { method: "GET" });
    notifyStatus = (await notifyResponse.text()).trim();
  } catch (error) {
    notifyStatus = `fail: ${error.message}`;
  }

  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(`<!doctype html><html lang="zh-CN"><meta charset="utf-8">
<title>Mock 易支付</title>
<body style="font-family:system-ui;display:grid;place-items:center;min-height:100vh;background:#f5f7fb">
<div style="padding:32px 40px;background:#fff;border-radius:16px;box-shadow:0 10px 30px rgba(15,23,42,.08);text-align:center">
<h1 style="color:#059669;margin:0 0 8px">✔ 支付成功（本地 Mock）</h1>
<p>订单号：${params.out_trade_no}</p>
<p>金额：￥${params.money}</p>
<p>回调结果：${notifyStatus}</p>
<p style="color:#64748b;font-size:13px">真实环境中此处为支付宝/微信收银台</p>
</div></body></html>`);
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[mock-epay] listening on http://127.0.0.1:${PORT}`);
});
