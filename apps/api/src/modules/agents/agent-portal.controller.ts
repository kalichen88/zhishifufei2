import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { Request } from "express";

import { AgentWithdrawalRequestDto } from "./agents.dto";
import { AgentAuthGuard } from "./agent-auth.guard";
import { AgentsService } from "./agents.service";

@Controller("agent-portal")
@UseGuards(AgentAuthGuard)
export class AgentPortalController {
  constructor(
    private readonly agentsService: AgentsService,
    private readonly jwtService: JwtService
  ) {}

  @Get("profile")
  getProfile(@Req() request: Request & { agent?: { id: string } }) {
    return this.agentsService.getAgentById(request.agent!.id);
  }

  @Get("stats")
  getStats(@Req() request: Request & { agent?: { id: string } }) {
    return this.agentsService.agentPortalStats(request.agent!.id);
  }

  @Get("commissions")
  listCommissions(@Req() request: Request & { agent?: { id: string } }) {
    return this.agentsService.listAgentCommissions(request.agent!.id);
  }

  @Get("withdrawals")
  listWithdrawals(@Req() request: Request & { agent?: { id: string } }) {
    return this.agentsService.listAgentWithdrawals(request.agent!.id);
  }

  @Post("withdrawals")
  requestWithdrawal(
    @Req() request: Request & { agent?: { id: string } },
    @Body() payload: AgentWithdrawalRequestDto
  ) {
    return this.agentsService.requestWithdrawal(
      request.agent!.id,
      payload.amountCents,
      payload.accountInfo
    );
  }
}
