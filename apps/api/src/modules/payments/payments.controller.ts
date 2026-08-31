import {
  Controller,
  Get,
  NotFoundException,
  Query,
  Res
} from "@nestjs/common";
import type { Response } from "express";

import { PaymentsService } from "./payments.service";

@Controller("payments")
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get("epay/create")
  async createEpay(
    @Query("orderNo") orderNo: string,
    @Query("type") payType = "alipay"
  ) {
    if (!orderNo) {
      throw new NotFoundException("缺少订单号");
    }

    return this.paymentsService.createEpayUrl(orderNo, payType);
  }

  @Get("epay/notify")
  async epayNotify(
    @Query() query: Record<string, string>,
    @Res() res: Response
  ) {
    const ok = await this.paymentsService.handleEpayNotify(query);
    res.type("text/plain").send(ok ? "success" : "fail");
  }

  @Get("epay/return")
  epayReturn(@Query("out_trade_no") orderNo: string, @Res() res: Response) {
    res.redirect(this.paymentsService.buildReturnRedirectUrl(orderNo));
  }
}
