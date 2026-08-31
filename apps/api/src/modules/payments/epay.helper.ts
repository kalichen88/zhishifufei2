import { createHash } from "node:crypto";

// 彩虹易支付标准 MD5 签名：
// 1. 参数按 key ASCII 升序排序
// 2. 排除 sign、sign_type 和空值
// 3. 拼接成 key1=value1&key2=value2
// 4. sign = md5(拼接串 + 商户密钥) 小写
export function buildEpaySignString(
  params: Record<string, string | number | undefined | null>
): string {
  return Object.keys(params)
    .filter(
      (key) =>
        key !== "sign" &&
        key !== "sign_type" &&
        params[key] !== undefined &&
        params[key] !== null &&
        String(params[key]) !== ""
    )
    .sort()
    .map((key) => `${key}=${String(params[key])}`)
    .join("&");
}

export function epaySign(
  params: Record<string, string | number | undefined | null>,
  merchantKey: string
): string {
  return createHash("md5")
    .update(`${buildEpaySignString(params)}${merchantKey}`, "utf8")
    .digest("hex");
}

export function verifyEpaySign(
  params: Record<string, string | number | undefined | null>,
  merchantKey: string
): boolean {
  const sign = String(params.sign ?? "");

  if (!sign) {
    return false;
  }

  const expected = epaySign(params, merchantKey);
  return expected.toLowerCase() === sign.toLowerCase();
}
