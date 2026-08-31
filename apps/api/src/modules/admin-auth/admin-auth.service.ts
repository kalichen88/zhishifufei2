import {
  Injectable,
  OnModuleInit,
  UnauthorizedException
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import bcrypt from "bcryptjs";

import { PrismaService } from "../prisma/prisma.service";
import { AdminLoginDto } from "./admin-auth.dto";

@Injectable()
export class AdminAuthService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService
  ) {}

  // 启动时保证存在一个初始超管账号，密码来自环境变量
  async onModuleInit() {
    const username = process.env.ADMIN_INIT_USERNAME ?? "admin";
    const password = process.env.ADMIN_INIT_PASSWORD ?? "admin123456";

    const existing = await this.prisma.adminUser.findUnique({
      where: { username }
    });

    if (existing) {
      return;
    }

    await this.prisma.adminUser.create({
      data: {
        username,
        passwordHash: await bcrypt.hash(password, 10),
        displayName: "超级管理员",
        role: "SUPER_ADMIN"
      }
    });
  }

  async login(payload: AdminLoginDto) {
    const admin = await this.prisma.adminUser.findUnique({
      where: { username: payload.username }
    });

    if (!admin || admin.status !== "ACTIVE") {
      throw new UnauthorizedException("用户名或密码错误");
    }

    const passwordOk = await bcrypt.compare(
      payload.password,
      admin.passwordHash
    );

    if (!passwordOk) {
      throw new UnauthorizedException("用户名或密码错误");
    }

    const accessToken = await this.jwtService.signAsync({
      sub: admin.id,
      username: admin.username,
      role: admin.role,
      typ: "admin"
    });

    await this.prisma.adminUser.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() }
    });

    return {
      accessToken,
      admin: {
        id: admin.id,
        username: admin.username,
        displayName: admin.displayName,
        role: admin.role
      }
    };
  }

  async verify(token: string) {
    try {
      const payload = await this.jwtService.verifyAsync<{
        sub: string;
        username: string;
        role: string;
        typ?: string;
      }>(token);
      if (payload.typ !== "admin") {
        return null;
      }
      const admin = await this.prisma.adminUser.findUnique({
        where: { id: payload.sub }
      });

      if (!admin || admin.status !== "ACTIVE") {
        return null;
      }

      return {
        id: admin.id,
        username: admin.username,
        displayName: admin.displayName,
        role: admin.role
      };
    } catch {
      return null;
    }
  }
}
