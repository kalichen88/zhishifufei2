import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";

import { PrismaService } from "../prisma/prisma.service";
import {
  CreateAgentDto,
  ReviewWithdrawalDto,
  UpdateAgentDto
} from "./agents.dto";

@Injectable()
export class AgentsService {
  constructor(private readonly prisma: PrismaService) {}

  async createAgent(payload: CreateAgentDto) {
    const existing = await this.prisma.agentAccount.findUnique({
      where: { username: payload.username }
    });

    if (existing) {
      throw new BadRequestException("代理用户名已存在");
    }

    if (payload.referredByAgentId) {
      const parent = await this.prisma.agentAccount.findUnique({
        where: { id: payload.referredByAgentId }
      });

      if (!parent) {
        throw new BadRequestException("上级代理不存在");
      }
    }

    const inviteCode = await this.generateUniqueInviteCode();

    const agent = await this.prisma.agentAccount.create({
      data: {
        username: payload.username,
        passwordHash: await bcrypt.hash(payload.password, 10),
        displayName: payload.displayName ?? payload.username,
        inviteCode,
        commissionRateL1: payload.commissionRateL1 ?? 3000,
        commissionRateL2: payload.commissionRateL2 ?? 1000,
        referredByAgentId: payload.referredByAgentId ?? null
      }
    });

    return this.toSafeAgent(agent);
  }

  async listAgents() {
    const [agents, commissionSums, pendingWithdrawalSums] = await Promise.all([
      this.prisma.agentAccount.findMany({
        include: {
          referredBy: {
            select: { id: true, username: true }
          },
          _count: {
            select: { referrals: true }
          }
        },
        orderBy: { createdAt: "desc" }
      }),
      this.prisma.agentCommission.groupBy({
        by: ["agentId"],
        _sum: { amountCents: true }
      }),
      this.prisma.agentWithdrawal.groupBy({
        by: ["agentId"],
        where: { status: "PENDING" },
        _sum: { amountCents: true }
      })
    ]);

    const commissionMap = new Map(
      commissionSums.map((item) => [item.agentId, item._sum.amountCents ?? 0])
    );
    const pendingMap = new Map(
      pendingWithdrawalSums.map((item) => [
        item.agentId,
        item._sum.amountCents ?? 0
      ])
    );

    return agents.map((agent) => ({
      ...this.toSafeAgent(agent),
      referredBy: agent.referredBy,
      referralCount: agent._count.referrals,
      commissionTotalCents: commissionMap.get(agent.id) ?? 0,
      pendingWithdrawalCents: pendingMap.get(agent.id) ?? 0
    }));
  }

  async updateAgent(id: string, payload: UpdateAgentDto) {
    const agent = await this.prisma.agentAccount.findUnique({ where: { id } });

    if (!agent) {
      throw new NotFoundException("代理不存在");
    }

    const updated = await this.prisma.agentAccount.update({
      where: { id },
      data: {
        displayName: payload.displayName,
        commissionRateL1: payload.commissionRateL1,
        commissionRateL2: payload.commissionRateL2,
        status: payload.status
      }
    });

    return this.toSafeAgent(updated);
  }

  async resetPassword(id: string, password: string) {
    const agent = await this.prisma.agentAccount.findUnique({ where: { id } });

    if (!agent) {
      throw new NotFoundException("代理不存在");
    }

    await this.prisma.agentAccount.update({
      where: { id },
      data: { passwordHash: await bcrypt.hash(password, 10) }
    });

    return { success: true };
  }

  async requestWithdrawal(agentId: string, amountCents: number, accountInfo: string) {
    return this.prisma.$transaction(async (tx) => {
      const agent = await tx.agentAccount.findUnique({
        where: { id: agentId }
      });

      if (!agent || agent.status !== "ACTIVE") {
        throw new BadRequestException("代理账号不可用");
      }

      if (amountCents > agent.balanceCents) {
        throw new BadRequestException("提现金额超过可提现余额");
      }

      // 先冻结（扣减）余额，再创建待审核提现单
      await tx.agentAccount.update({
        where: { id: agentId },
        data: { balanceCents: { decrement: amountCents } }
      });

      return tx.agentWithdrawal.create({
        data: {
          agentId,
          amountCents,
          accountInfo
        }
      });
    });
  }

  async reviewWithdrawal(payload: ReviewWithdrawalDto) {
    return this.prisma.$transaction(async (tx) => {
      const withdrawal = await tx.agentWithdrawal.findUnique({
        where: { id: payload.withdrawalId },
        include: { agent: true }
      });

      if (!withdrawal) {
        throw new NotFoundException("提现单不存在");
      }

      if (withdrawal.status !== "PENDING") {
        throw new BadRequestException("提现单已处理，不能重复审核");
      }

      const updated = await tx.agentWithdrawal.update({
        where: { id: withdrawal.id },
        data: {
          status: payload.action,
          note: payload.note ?? "",
          processedAt: new Date()
        }
      });

      // 拒绝时把冻结余额退回
      if (payload.action === "REJECTED") {
        await tx.agentAccount.update({
          where: { id: withdrawal.agentId },
          data: { balanceCents: { increment: withdrawal.amountCents } }
        });
      }

      return updated;
    });
  }

  async agentLogin(username: string, password: string, signToken: (payload: Record<string, unknown>) => Promise<string>) {
    const agent = await this.prisma.agentAccount.findUnique({
      where: { username }
    });

    if (!agent || agent.status !== "ACTIVE") {
      throw new BadRequestException("用户名或密码错误");
    }

    const passwordOk = await bcrypt.compare(password, agent.passwordHash);

    if (!passwordOk) {
      throw new BadRequestException("用户名或密码错误");
    }

    await this.prisma.agentAccount.update({
      where: { id: agent.id },
      data: { lastLoginAt: new Date() }
    });

    const accessToken = await signToken({
      sub: agent.id,
      username: agent.username,
      typ: "agent"
    });

    return {
      accessToken,
      agent: this.toSafeAgent(agent)
    };
  }

  async getAgentById(agentId: string) {
    const agent = await this.prisma.agentAccount.findUnique({
      where: { id: agentId }
    });

    if (!agent) {
      throw new NotFoundException("代理不存在");
    }

    return this.toSafeAgent(agent);
  }

  async agentPortalStats(agentId: string) {
    const agent = await this.prisma.agentAccount.findUnique({
      where: { id: agentId }
    });

    if (!agent) {
      throw new NotFoundException("代理不存在");
    }

    const [referralCount, commissionSum, pendingWithdrawalSum] =
      await Promise.all([
        this.prisma.agentReferral.count({ where: { agentId } }),
        this.prisma.agentCommission.aggregate({
          where: { agentId },
          _sum: { amountCents: true }
        }),
        this.prisma.agentWithdrawal.aggregate({
          where: { agentId, status: "PENDING" },
          _sum: { amountCents: true }
        })
      ]);

    return {
      balanceCents: agent.balanceCents,
      referralCount,
      commissionTotalCents: commissionSum._sum.amountCents ?? 0,
      pendingWithdrawalCents: pendingWithdrawalSum._sum.amountCents ?? 0,
      commissionRateL1: agent.commissionRateL1,
      commissionRateL2: agent.commissionRateL2
    };
  }

  async listAgentCommissions(agentId: string) {
    return this.prisma.agentCommission.findMany({
      where: { agentId },
      orderBy: { createdAt: "desc" },
      take: 100
    });
  }

  async listAgentWithdrawals(agentId: string) {
    return this.prisma.agentWithdrawal.findMany({
      where: { agentId },
      orderBy: { createdAt: "desc" },
      take: 100
    });
  }

  async listAllWithdrawals() {
    return this.prisma.agentWithdrawal.findMany({
      include: {
        agent: {
          select: { id: true, username: true, displayName: true }
        }
      },
      orderBy: { createdAt: "desc" },
      take: 200
    });
  }

  private async generateUniqueInviteCode() {
    for (let i = 0; i < 5; i += 1) {
      const inviteCode = `A${randomBytes(4).toString("hex").toUpperCase()}`;
      const exists = await this.prisma.agentAccount.findUnique({
        where: { inviteCode }
      });

      if (!exists) {
        return inviteCode;
      }
    }
    throw new Error("邀请码生成失败，请重试");
  }

  private toSafeAgent(agent: {
    id: string;
    username: string;
    displayName: string;
    inviteCode: string;
    commissionRateL1: number;
    commissionRateL2: number;
    balanceCents: number;
    status: string;
    createdAt: Date;
    lastLoginAt: Date | null;
  }) {
    return {
      id: agent.id,
      username: agent.username,
      displayName: agent.displayName,
      inviteCode: agent.inviteCode,
      commissionRateL1: agent.commissionRateL1,
      commissionRateL2: agent.commissionRateL2,
      balanceCents: agent.balanceCents,
      status: agent.status,
      lastLoginAt: agent.lastLoginAt,
      createdAt: agent.createdAt
    };
  }
}
