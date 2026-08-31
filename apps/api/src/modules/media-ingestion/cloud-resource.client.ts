import { Injectable, InternalServerErrorException } from "@nestjs/common";
import type { CloudResourceRecord, RenewResourceRow } from "@repo/types";
import { hmacSha256Hex } from "@repo/utils";

interface CloudListResponse {
  code: number;
  msg: string;
  data?: {
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
    list: CloudResourceRecord[];
  };
}

interface CloudRenewResponse {
  code: number;
  msg: string;
  data?: {
    count: number;
    rows: RenewResourceRow[];
  };
}

@Injectable()
export class CloudResourceClient {
  private get baseUrl(): string {
    return (process.env.YZM_RESOURCE_API_BASE ?? "").replace(/\/$/, "");
  }

  private get resourceKey(): string {
    return process.env.YZM_RESOURCE_API_KEY ?? "";
  }

  async listResources(params: {
    updatedAfter: number;
    page: number;
    pageSize: number;
    includeDeleted: boolean;
  }) {
    this.assertConfigured();

    const ts = this.nowUnix();
    const sign = hmacSha256Hex(this.resourceKey, `${ts}|`);
    const url = new URL(`${this.baseUrl}/api/v1/open/resources`);

    url.searchParams.set("key", this.resourceKey);
    url.searchParams.set("ts", String(ts));
    url.searchParams.set("sign", sign);
    url.searchParams.set("updated_after", String(params.updatedAfter));
    url.searchParams.set("page", String(params.page));
    url.searchParams.set("pageSize", String(params.pageSize));
    url.searchParams.set("include_deleted", params.includeDeleted ? "1" : "0");

    const response = await fetch(url, {
      method: "GET"
    });

    const payload = (await response.json()) as CloudListResponse;
    this.assertSuccess(response.ok, payload.code, payload.msg);

    return payload.data ?? {
      total: 0,
      page: params.page,
      pageSize: params.pageSize,
      hasMore: false,
      list: []
    };
  }

  async renewResources(params: {
    vids: string[];
    ttl: number;
    domain: string;
  }) {
    this.assertConfigured();

    const ts = this.nowUnix();
    const rawBody = JSON.stringify({
      vids: params.vids,
      ttl: params.ttl,
      domain: params.domain
    });
    const sign = hmacSha256Hex(this.resourceKey, `${ts}|${rawBody}`);
    const url = new URL(`${this.baseUrl}/api/v1/open/resources/renew`);

    url.searchParams.set("key", this.resourceKey);
    url.searchParams.set("ts", String(ts));
    url.searchParams.set("sign", sign);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: rawBody
    });

    const payload = (await response.json()) as CloudRenewResponse;
    this.assertSuccess(response.ok, payload.code, payload.msg);

    return payload.data ?? {
      count: 0,
      rows: []
    };
  }

  private assertSuccess(httpOk: boolean, code: number | undefined, message: string | undefined) {
    if (!httpOk || code !== 0) {
      throw new InternalServerErrorException(
        `云转码接口调用失败: ${message ?? "unknown-error"}`
      );
    }
  }

  private assertConfigured() {
    if (!this.baseUrl || !this.resourceKey) {
      throw new InternalServerErrorException("云转码资源接入配置缺失");
    }
  }

  private nowUnix() {
    return Math.floor(Date.now() / 1000);
  }
}
