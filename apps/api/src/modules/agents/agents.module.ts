import { Module } from "@nestjs/common";

import { AgentAuthController } from "./agent-auth.controller";
import { AgentAuthGuard } from "./agent-auth.guard";
import { AgentPortalController } from "./agent-portal.controller";
import { AgentsController } from "./agents.controller";
import { AgentsService } from "./agents.service";

@Module({
  controllers: [AgentAuthController, AgentsController, AgentPortalController],
  providers: [AgentsService, AgentAuthGuard],
  exports: [AgentsService]
})
export class AgentsModule {}
