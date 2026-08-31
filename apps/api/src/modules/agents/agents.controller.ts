import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";

import { AdminAuthGuard } from "../admin-auth/admin-auth.guard";
import {
  CreateAgentDto,
  ResetAgentPasswordDto,
  ReviewWithdrawalDto,
  UpdateAgentDto
} from "./agents.dto";
import { AgentsService } from "./agents.service";

@Controller("agents")
@UseGuards(AdminAuthGuard)
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Post()
  create(@Body() payload: CreateAgentDto) {
    return this.agentsService.createAgent(payload);
  }

  @Get()
  list() {
    return this.agentsService.listAgents();
  }

  @Get("withdrawals")
  listWithdrawals() {
    return this.agentsService.listAllWithdrawals();
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() payload: UpdateAgentDto) {
    return this.agentsService.updateAgent(id, payload);
  }

  @Post(":id/reset-password")
  resetPassword(@Param("id") id: string, @Body() payload: ResetAgentPasswordDto) {
    return this.agentsService.resetPassword(id, payload.password);
  }

  @Post("withdrawals/review")
  reviewWithdrawal(@Body() payload: ReviewWithdrawalDto) {
    return this.agentsService.reviewWithdrawal(payload);
  }
}
