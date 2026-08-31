import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { Request } from "express";

import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AgentAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers.authorization ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";

    if (!token) {
      throw new UnauthorizedException("缺少代理登录凭证");
    }

    try {
      const payload = await this.jwtService.verifyAsync<{
        sub: string;
        typ?: string;
      }>(token);

      if (payload.typ !== "agent") {
        throw new UnauthorizedException("凭证类型无效");
      }

      const agent = await this.prisma.agentAccount.findUnique({
        where: { id: payload.sub }
      });

      if (!agent || agent.status !== "ACTIVE") {
        throw new UnauthorizedException("代理账号不可用");
      }

      (request as Request & { agent?: unknown }).agent = {
        id: agent.id,
        username: agent.username,
        displayName: agent.displayName,
        inviteCode: agent.inviteCode
      };
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException("代理登录凭证无效或已过期");
    }
  }
}
