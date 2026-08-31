import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException
} from "@nestjs/common";
import { ViewerOrderStatus } from "@prisma/client";

import { MediaIngestionService } from "../media-ingestion/media-ingestion.service";
import { epaySign, verifyEpaySign } from "./epay.helper";

@Injectable()
export class PaymentsService {
  constructor(
    private readonly mediaIngestionService: MediaIngestionService
  ) {}

  private get config() {
    return {
      apiUrl: (process.env.EPAY_API_URL ?? "").replace(/\/$/, ""),
      pid: process.env.EPAY_PID ?? "",
      key: process.env.EPAY_KEY ?? "",
      apiPublicBaseUrl: (
        process.env.PAY_API_PUBLIC_BASE_URL ??
        "http://127.0.0.1:3002/api"
      ).replace(/\/$/, ""),
      webBaseUrl: (process.env.PAY_WEB_BASE_URL ?? "http://localhost:3000")
        .replace(/\/$/, "")
    };
  }

  async createEpayUrl(orderNo: string, payType: string) {
    const config = this.config;

    if (!config.apiUrl || !config.pid || !config.key) {
      throw new InternalServerErrorException("易支付配置缺失（EPAY_API_URL / EPAY_PID / EPAY_KEY）");
    }

    if (!["alipay", "wxpay", "qqpay"].includes(payType)) {
      throw new BadRequestException("不支持的支付方式");
    }

    const order = await this.mediaIngestionService.getOrderByOrderNo(orderNo);

    if (!order) {
      throw new NotFoundException("订单不存在");
    }

    if (order.status === ViewerOrderStatus.PAID) {
      throw new BadRequestException("订单已支付，无需重复支付");
    }

    const orderName =
      order.membershipPlan?.name ?? order.contentItem?.title ?? `订单${order.orderNo}`;

    const params: Record<string, string> = {
      pid: config.pid,
      type: payType,
      out_trade_no: order.orderNo,
      notify_url: `${config.apiPublicBaseUrl}/payments/epay/notify`,
      return_url: `${config.webBaseUrl}/me?payReturn=${order.orderNo}`,
      name: orderName,
      money: (order.amountCents / 100).toFixed(2)
    };
    const sign = epaySign(params, config.key);

    const query = new URLSearchParams(params);
    query.set("sign", sign);
    query.set("sign_type", "MD5");

    return {
      orderNo: order.orderNo,
      payType,
      payUrl: `${config.apiUrl}/submit.php?${query.toString()}`
    };
  }

  async handleEpayNotify(query: Record<string, string>): Promise<boolean> {
    const config = this.config;

    if (!config.key) {
      return false;
    }

    if (!verifyEpaySign(query, config.key)) {
      return false;
    }

    if (
      query.trade_status !== "TRADE_SUCCESS" &&
      query.trade_status !== "TRADE_FINISHED"
    ) {
      return true; // 非成功状态也要应答 success，避免网关重发
    }

    if (!query.out_trade_no) {
      return false;
    }

    // completeOrder 幂等：已支付订单直接返回
    await this.mediaIngestionService.completeOrder({
      orderNo: query.out_trade_no
    });
    return true;
  }

  buildReturnRedirectUrl(orderNo?: string): string {
    const config = this.config;
    const target = orderNo
      ? `${config.webBaseUrl}/me?payReturn=${encodeURIComponent(orderNo)}`
      : `${config.webBaseUrl}/me`;
    return target;
  }
}
