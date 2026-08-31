import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";

import { AdminAuthService } from "./admin-auth.service";
import { IS_PUBLIC_KEY } from "./public.decorator";

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly adminAuthService: AdminAuthService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers.authorization ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";

    if (!token) {
      throw new UnauthorizedException("缺少管理员登录凭证");
    }

    const admin = await this.adminAuthService.verify(token);

    if (!admin) {
      throw new UnauthorizedException("管理员登录凭证无效或已过期");
    }

    (request as Request & { admin?: unknown }).admin = admin;
    return true;
  }
}
