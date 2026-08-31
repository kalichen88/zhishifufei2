import { Injectable } from "@nestjs/common";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import type { CloudResourceRecord, RenewResourceRow, SyncState } from "@repo/types";
import { hmacSha256Hex, isSafeEqual } from "@repo/utils";
import {
  CloudSyncState,
  ContentAccessType,
  CsvImportStatus,
  ViewerOrderStatus,
  ViewerOrderType,
  MembershipStatus,
  Prisma,
  PublishState,
  WebhookEventType,
  WebhookProcessState
} from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { CloudResourceClient } from "./cloud-resource.client";
import type {
  CompleteOrderDto,
  ContentCatalogQueryDto,
  ContentDetailQueryDto,
  CreateContentOrderDto,
  CreateMembershipOrderDto,
  CsvImportDto,
  GrantMembershipDto,
  GrantPurchaseDto,
  HandleWebhookDto,
  MediaAssetListQueryDto,
  OperationListQueryDto,
  PlaybackAuthorizeDto,
  PersistSyncBatchDto,
  PreviewSyncBatchDto,
  RenewRemoteUrlsDto,
  RenewPlanDto,
  SyncRemoteResourcesDto,
  UpsertContentConfigDto,
  UpsertMembershipPlanDto,
  VerifyWebhookDto,
  ViewerProfileQueryDto,
  ViewerOrderListQueryDto
} from "./media-ingestion.dto";

@Injectable()
export class MediaIngestionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudResourceClient: CloudResourceClient
  ) {}

  private get resourceKey(): string {
    return process.env.YZM_RESOURCE_API_KEY ?? "replace-me";
  }

  signGetRequest(ts: number) {
    return {
      ts,
      sign: hmacSha256Hex(this.resourceKey, `${ts}|`)
    };
  }

  signPostRequest(ts: number, rawBody: string) {
    return {
      ts,
      sign: hmacSha256Hex(this.resourceKey, `${ts}|${rawBody}`)
    };
  }

  verifyWebhook(body: VerifyWebhookDto) {
    const now = Math.floor(Date.now() / 1000);
    const inTimeWindow = Math.abs(now - Number(body.ts)) <= 300;
    const expected = hmacSha256Hex(
      this.resourceKey,
      `${body.ts}|${body.event}|${body.id}|${body.vid}`
    );

    return {
      ok: inTimeWindow && isSafeEqual(expected, body.sign),
      inTimeWindow,
      expectedSign: expected
    };
  }

  previewSync(batch: PreviewSyncBatchDto) {
    return batch.items.map((item) => {
      const normalized = this.normalizeCloudResource(item);

      return {
        cloudVid: normalized.vid,
        title: normalized.title,
        syncState: this.mapSyncState(normalized),
        shouldRenewPlayableUrl: normalized.available && !normalized.deleted,
        shouldRenewStaticCover: normalized.hasStaticCover,
        shouldRenewGifCover: normalized.hasGifCover,
        lastUpdatedAt: normalized.updatedAt
      };
    });
  }

  async persistSync(batch: PersistSyncBatchDto) {
    const nowUnix = this.nowUnix();

    const operations = batch.items.map((item) => {
      const normalized = this.normalizeCloudResource(item);

      return this.prisma.cloudMediaAsset.upsert({
        where: {
          cloudVid: normalized.vid
        },
        update: {
          cloudInternalId: normalized.id,
          title: normalized.title,
          categoryName: normalized.category,
          durationSec: new Prisma.Decimal(normalized.duration),
          sizeBytes: BigInt(Math.max(0, Math.floor(normalized.size))),
          sourceMd5: normalized.sourceMd5,
          hasStaticCover: normalized.hasStaticCover,
          hasGifCover: normalized.hasGifCover,
          cloudStatus: normalized.status,
          cloudSyncState: this.toPrismaSyncState(normalized),
          cloudCreatedAt: normalized.createdAt,
          cloudUpdatedAt: normalized.updatedAt,
          lastSyncedAt: nowUnix
        },
        create: {
          cloudVid: normalized.vid,
          cloudInternalId: normalized.id,
          title: normalized.title,
          categoryName: normalized.category,
          durationSec: new Prisma.Decimal(normalized.duration),
          sizeBytes: BigInt(Math.max(0, Math.floor(normalized.size))),
          sourceMd5: normalized.sourceMd5,
          hasStaticCover: normalized.hasStaticCover,
          hasGifCover: normalized.hasGifCover,
          cloudStatus: normalized.status,
          cloudSyncState: this.toPrismaSyncState(normalized),
          publishState: PublishState.DRAFT,
          cloudCreatedAt: normalized.createdAt,
          cloudUpdatedAt: normalized.updatedAt,
          lastSyncedAt: nowUnix
        }
      });
    });

    await this.prisma.$transaction([
      ...operations,
      this.prisma.cloudSyncCursor.upsert({
        where: {
          cursorKey: "media-assets"
        },
        update: {
          lastUpdatedAfter: batch.maxUpdatedAt,
          lastSyncAt: new Date()
        },
        create: {
          cursorKey: "media-assets",
          lastUpdatedAfter: batch.maxUpdatedAt,
          lastSyncAt: new Date()
        }
      })
    ]);

    return {
      upserted: batch.items.length,
      cursorKey: "media-assets",
      nextUpdatedAfter: batch.maxUpdatedAt
    };
  }

  async syncRemoteResources(payload: SyncRemoteResourcesDto) {
    const remote = await this.cloudResourceClient.listResources({
      updatedAfter: payload.updatedAfter ?? 0,
      page: payload.page ?? 1,
      pageSize: payload.pageSize ?? 100,
      includeDeleted: payload.includeDeleted ?? true
    });
    const maxUpdatedAt = remote.list.reduce(
      (acc, item) => Math.max(acc, item.updatedAt),
      payload.updatedAfter ?? 0
    );

    const persisted =
      payload.persist === false
        ? null
        : await this.persistSync({
            items: remote.list,
            maxUpdatedAt
          });

    return {
      remote,
      persisted
    };
  }

  buildRenewPlan(payload: RenewPlanDto) {
    return {
      chunkCount: Math.ceil(payload.vids.length / 200),
      domain: payload.domain ?? "primary",
      ttl: payload.ttl,
      chunks: this.chunk(payload.vids, 200).map((vids, index) => ({
        index: index + 1,
        size: vids.length,
        vids
      }))
    };
  }

  async renewRemoteUrls(payload: RenewRemoteUrlsDto) {
    const vids = [...new Set(payload.vids.map((item) => item.trim()).filter(Boolean))];

    if (vids.length === 0) {
      throw new BadRequestException("至少提供一个有效的 cloud vid");
    }

    const renewed = await this.cloudResourceClient.renewResources({
      vids,
      ttl: payload.ttl,
      domain: payload.domain ?? "primary"
    });

    if (payload.persist !== false) {
      await this.persistRenewedRows(renewed.rows);
    }

    return renewed;
  }

  async listAssets(query: MediaAssetListQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.CloudMediaAssetWhereInput = {
      ...(query.keyword
        ? {
            OR: [
              {
                title: {
                  contains: query.keyword,
                  mode: "insensitive"
                }
              },
              {
                cloudVid: {
                  contains: query.keyword,
                  mode: "insensitive"
                }
              }
            ]
          }
        : {}),
      ...(query.categoryName
        ? {
            categoryName: query.categoryName
          }
        : {}),
      ...(query.syncState
        ? {
            cloudSyncState: query.syncState as CloudSyncState
          }
        : {})
    };

    const [items, total, cursor] = await this.prisma.$transaction([
      this.prisma.cloudMediaAsset.findMany({
        where,
        orderBy: {
          cloudUpdatedAt: "desc"
        },
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      this.prisma.cloudMediaAsset.count({ where }),
      this.prisma.cloudSyncCursor.findUnique({
        where: {
          cursorKey: "media-assets"
        }
      })
    ]);

    return {
      page,
      pageSize,
      total,
      cursor,
      items: items.map((item) => ({
        ...item,
        sizeBytes: Number(item.sizeBytes)
      }))
    };
  }

  async handleWebhook(payload: HandleWebhookDto) {
    const verification = this.verifyWebhook(payload);
    const eventType = this.resolveWebhookEvent(payload);
    const eventKey = `${payload.event}:${payload.id}:${payload.vid}:${payload.ts}`;
    const jsonPayload = payload as unknown as Prisma.InputJsonValue;

    const event = await this.prisma.cloudWebhookEvent.upsert({
      where: {
        eventKey
      },
      update: {
        payload: jsonPayload,
        processState: verification.ok
          ? WebhookProcessState.PROCESSED
          : WebhookProcessState.FAILED,
        processNote: verification.ok ? "accepted" : "invalid-signature",
        processedAt: verification.ok ? new Date() : null
      },
      create: {
        eventType,
        eventKey,
        cloudInternalId: payload.id,
        cloudVid: payload.vid,
        payload: jsonPayload,
        processState: verification.ok
          ? WebhookProcessState.PROCESSED
          : WebhookProcessState.FAILED,
        processNote: verification.ok ? "accepted" : "invalid-signature",
        processedAt: verification.ok ? new Date() : null
      }
    });

    if (verification.ok && eventType !== WebhookEventType.UNKNOWN) {
      await this.prisma.cloudMediaAsset.updateMany({
        where: {
          cloudVid: payload.vid
        },
        data: {
          cloudStatus: payload.status ?? 0,
          cloudSyncState:
            eventType === WebhookEventType.RESOURCE_DELETED
              ? CloudSyncState.DELETED
              : CloudSyncState.OFFLINE,
          lastSyncedAt: this.nowUnix()
        }
      });
    }

    return {
      verification,
      event
    };
  }

  async authorizePlayback(payload: PlaybackAuthorizeDto) {
    const asset = await this.prisma.cloudMediaAsset.findUnique({
      where: {
        cloudVid: payload.cloudVid
      }
    });

    if (!asset) {
      throw new NotFoundException("资源不存在，请先完成同步入库");
    }

    if (asset.cloudSyncState !== CloudSyncState.ACTIVE) {
      throw new BadRequestException("资源当前不可播放");
    }

    const contentItem = await this.prisma.contentItem.findUnique({
      where: {
        cloudVid: payload.cloudVid
      }
    });

    if (contentItem) {
      if (contentItem.publishState !== PublishState.PUBLISHED) {
        throw new BadRequestException("内容当前未上架");
      }

      await this.assertPlaybackAccess(contentItem, payload.viewerKey);
    }

    // 这里先只做资源状态校验，后续接入会员/订单权限体系后再补业务授权。
    const nowUnix = this.nowUnix();
    const remainingTtl = asset.urlExpiresAt - nowUnix;
    const shouldRefresh =
      payload.forceRefresh === true ||
      !asset.resourceUrl ||
      remainingTtl <= 120;

    if (!shouldRefresh) {
      return {
        cloudVid: asset.cloudVid,
        title: asset.title,
        accessType: contentItem?.accessType ?? ContentAccessType.FREE,
        contentConfigured: Boolean(contentItem),
        expiresAt: asset.urlExpiresAt,
        resourceUrl: asset.resourceUrl,
        resourceUrl2: asset.resourceUrl2,
        staticCoverUrl: asset.staticCoverUrl,
        gifCoverUrl: asset.gifCoverUrl,
        playUrl: asset.playUrl,
        source: "cache"
      };
    }

    const renewed = await this.renewRemoteUrls({
      vids: [payload.cloudVid],
      ttl: payload.ttl ?? 3600,
      domain: payload.domain ?? "primary",
      persist: true
    });
    const row = renewed.rows.find((item) => item.vid === payload.cloudVid);

    if (!row?.resourceUrl) {
      throw new BadRequestException("云转码未返回可用播放地址");
    }

    return {
      cloudVid: row.vid,
      title: row.title,
      accessType: contentItem?.accessType ?? ContentAccessType.FREE,
      contentConfigured: Boolean(contentItem),
      expiresAt: row.expiresAt,
      resourceUrl: row.resourceUrl,
      resourceUrl2: row.resourceUrl2,
      staticCoverUrl: row.staticCoverUrl,
      gifCoverUrl: row.gifCoverUrl,
      playUrl: row.playUrl,
      source: "renew"
    };
  }

  async upsertContentConfig(payload: UpsertContentConfigDto) {
    const asset = await this.prisma.cloudMediaAsset.findUnique({
      where: {
        cloudVid: payload.cloudVid
      }
    });

    if (!asset) {
      throw new NotFoundException("资源不存在，请先完成同步入库");
    }

    return this.prisma.contentItem.upsert({
      where: {
        cloudVid: payload.cloudVid
      },
      update: {
        title: payload.title,
        accessType: payload.accessType as ContentAccessType,
        previewDurationSec: payload.previewDurationSec ?? 0,
        priceCents: payload.priceCents ?? 0,
        publishState: payload.publishState as PublishState
      },
      create: {
        cloudVid: payload.cloudVid,
        title: payload.title,
        accessType: payload.accessType as ContentAccessType,
        previewDurationSec: payload.previewDurationSec ?? 0,
        priceCents: payload.priceCents ?? 0,
        publishState: payload.publishState as PublishState
      }
    });
  }

  async upsertViewerAccount(payload: { viewerKey: string; displayName?: string }) {
    return this.prisma.viewerAccount.upsert({
      where: {
        viewerKey: payload.viewerKey
      },
      update: {
        displayName: payload.displayName ?? ""
      },
      create: {
        viewerKey: payload.viewerKey,
        displayName: payload.displayName ?? ""
      }
    });
  }

  async grantMembership(payload: GrantMembershipDto) {
    const viewer = await this.upsertViewerAccount(payload);

    return this.prisma.viewerMembership.create({
      data: {
        viewerAccountId: viewer.id,
        status: MembershipStatus.ACTIVE,
        expiresAtUnix: payload.expiresAtUnix
      }
    });
  }

  async grantPurchase(payload: GrantPurchaseDto) {
    const viewer = await this.upsertViewerAccount(payload);
    const contentItem = await this.prisma.contentItem.findUnique({
      where: {
        cloudVid: payload.cloudVid
      }
    });

    if (!contentItem) {
      throw new NotFoundException("内容配置不存在，请先创建内容配置");
    }

    return this.prisma.playbackEntitlement.upsert({
      where: {
        viewerAccountId_contentItemId: {
          viewerAccountId: viewer.id,
          contentItemId: contentItem.id
        }
      },
      update: {
        source: payload.source ?? "manual",
        expiresAtUnix: payload.expiresAtUnix
      },
      create: {
        viewerAccountId: viewer.id,
        contentItemId: contentItem.id,
        source: payload.source ?? "manual",
        expiresAtUnix: payload.expiresAtUnix
      }
    });
  }

  async upsertMembershipPlan(payload: UpsertMembershipPlanDto) {
    if (payload.id) {
      return this.prisma.membershipPlan.update({
        where: {
          id: payload.id
        },
        data: {
          name: payload.name,
          durationDays: payload.durationDays,
          priceCents: payload.priceCents,
          isActive: payload.isActive ?? true
        }
      });
    }

    return this.prisma.membershipPlan.create({
      data: {
        name: payload.name,
        durationDays: payload.durationDays,
        priceCents: payload.priceCents,
        isActive: payload.isActive ?? true
      }
    });
  }

  async listMembershipPlans(query: OperationListQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.membershipPlan.findMany({
        orderBy: {
          updatedAt: "desc"
        },
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      this.prisma.membershipPlan.count()
    ]);

    return {
      page,
      pageSize,
      total,
      items
    };
  }

  async getViewerProfile(query: ViewerProfileQueryDto) {
    const viewer = await this.prisma.viewerAccount.findUnique({
      where: {
        viewerKey: query.viewerKey.trim()
      },
      include: {
        memberships: {
          orderBy: {
            expiresAtUnix: "desc"
          }
        },
        entitlements: {
          include: {
            contentItem: true
          },
          orderBy: {
            createdAt: "desc"
          }
        },
        orders: {
          include: {
            membershipPlan: true,
            contentItem: true
          },
          orderBy: {
            createdAt: "desc"
          },
          take: 20
        }
      }
    });

    if (!viewer) {
      throw new NotFoundException("观看账号不存在，请先下单或授权创建 viewerKey");
    }

    const nowUnix = this.nowUnix();
    const activeMembership = viewer.memberships.find(
      (item) => item.status === MembershipStatus.ACTIVE && item.expiresAtUnix > nowUnix
    );
    const activeEntitlements = viewer.entitlements.filter(
      (item) => !item.expiresAtUnix || item.expiresAtUnix > nowUnix
    );

    return {
      viewerKey: viewer.viewerKey,
      displayName: viewer.displayName,
      membership: {
        hasActiveMembership: Boolean(activeMembership),
        activeExpiresAtUnix: activeMembership?.expiresAtUnix ?? null,
        totalMemberships: viewer.memberships.length
      },
      entitlements: activeEntitlements.map((item) => ({
        id: item.id,
        source: item.source,
        expiresAtUnix: item.expiresAtUnix,
        contentItem: {
          id: item.contentItem.id,
          title: item.contentItem.title,
          cloudVid: item.contentItem.cloudVid,
          accessType: item.contentItem.accessType
        }
      })),
      recentOrders: viewer.orders,
      stats: {
        paidOrderCount: viewer.orders.filter((item) => item.status === ViewerOrderStatus.PAID).length,
        pendingOrderCount: viewer.orders.filter((item) => item.status === ViewerOrderStatus.PENDING).length,
        entitlementCount: activeEntitlements.length
      }
    };
  }

  async createMembershipOrder(payload: CreateMembershipOrderDto) {
    const viewer = await this.upsertViewerAccount(payload);
    const membershipPlan = await this.prisma.membershipPlan.findUnique({
      where: {
        id: payload.membershipPlanId
      }
    });

    if (!membershipPlan || !membershipPlan.isActive) {
      throw new NotFoundException("会员方案不存在或未启用");
    }

    const order = await this.prisma.viewerOrder.create({
      data: {
        orderNo: this.generateOrderNo("VIP"),
        viewerAccountId: viewer.id,
        orderType: ViewerOrderType.MEMBERSHIP_PLAN,
        status: ViewerOrderStatus.PENDING,
        amountCents: membershipPlan.priceCents,
        membershipPlanId: membershipPlan.id
      }
    });
    await this.bindReferralIfNeeded(viewer.id, payload.referralCode);
    return order;
  }

  async createContentOrder(payload: CreateContentOrderDto) {
    const viewer = await this.upsertViewerAccount(payload);
    const contentItem = await this.prisma.contentItem.findUnique({
      where: {
        cloudVid: payload.cloudVid
      }
    });

    if (!contentItem) {
      throw new NotFoundException("内容配置不存在");
    }

    const order = await this.prisma.viewerOrder.create({
      data: {
        orderNo: this.generateOrderNo("CNT"),
        viewerAccountId: viewer.id,
        orderType: ViewerOrderType.CONTENT_PURCHASE,
        status: ViewerOrderStatus.PENDING,
        amountCents: contentItem.priceCents,
        contentItemId: contentItem.id
      }
    });
    await this.bindReferralIfNeeded(viewer.id, payload.referralCode);
    return order;
  }

  async getOrderByOrderNo(orderNo: string) {
    return this.prisma.viewerOrder.findUnique({
      where: {
        orderNo
      },
      include: {
        viewerAccount: true,
        membershipPlan: true,
        contentItem: true
      }
    });
  }

  async completeOrder(payload: CompleteOrderDto) {
    const order = await this.prisma.viewerOrder.findUnique({
      where: {
        orderNo: payload.orderNo
      },
      include: {
        viewerAccount: true,
        membershipPlan: true,
        contentItem: true
      }
    });

    if (!order) {
      throw new NotFoundException("订单不存在");
    }

    if (order.status === ViewerOrderStatus.PAID) {
      return order;
    }

    const now = new Date();
    const nowUnix = this.nowUnix();

    return this.prisma.$transaction(async (tx) => {
      const updatedOrder = await tx.viewerOrder.update({
        where: {
          id: order.id
        },
        data: {
          status: ViewerOrderStatus.PAID,
          paidAt: now
        }
      });

      if (
        updatedOrder.orderType === ViewerOrderType.MEMBERSHIP_PLAN &&
        order.membershipPlan
      ) {
        const latestMembership = await tx.viewerMembership.findFirst({
          where: {
            viewerAccountId: order.viewerAccountId,
            status: MembershipStatus.ACTIVE
          },
          orderBy: {
            expiresAtUnix: "desc"
          }
        });
        const baseUnix = Math.max(latestMembership?.expiresAtUnix ?? 0, nowUnix);
        const expiresAtUnix =
          baseUnix + order.membershipPlan.durationDays * 24 * 60 * 60;

        await tx.viewerMembership.create({
          data: {
            viewerAccountId: order.viewerAccountId,
            status: MembershipStatus.ACTIVE,
            expiresAtUnix
          }
        });
      }

      if (
        updatedOrder.orderType === ViewerOrderType.CONTENT_PURCHASE &&
        order.contentItem
      ) {
        await tx.playbackEntitlement.upsert({
          where: {
            viewerAccountId_contentItemId: {
              viewerAccountId: order.viewerAccountId,
              contentItemId: order.contentItem.id
            }
          },
          update: {
            source: "order-paid"
          },
          create: {
            viewerAccountId: order.viewerAccountId,
            contentItemId: order.contentItem.id,
            source: "order-paid"
          }
        });
      }

      await this.applyAgentCommissions(tx, updatedOrder);

      return updatedOrder;
    });
  }

  private async bindReferralIfNeeded(
    viewerAccountId: string,
    referralCode?: string
  ) {
    if (!referralCode || !referralCode.trim()) {
      return;
    }

    const agent = await this.prisma.agentAccount.findUnique({
      where: {
        inviteCode: referralCode.trim()
      }
    });

    if (!agent || agent.status !== "ACTIVE") {
      return;
    }

    // 首次绑定生效，之后不允许改绑
    await this.prisma.agentReferral.upsert({
      where: {
        viewerAccountId
      },
      update: {},
      create: {
        agentId: agent.id,
        viewerAccountId
      }
    });
  }

  private async applyAgentCommissions(
    tx: Prisma.TransactionClient,
    order: {
      id: string;
      viewerAccountId: string;
      amountCents: number;
    }
  ) {
    const referral = await tx.agentReferral.findUnique({
      where: {
        viewerAccountId: order.viewerAccountId
      },
      include: {
        agent: {
          include: {
            referredBy: true
          }
        }
      }
    });

    if (!referral || referral.agent.status !== "ACTIVE") {
      return;
    }

    const agent = referral.agent;
    const level1Amount = Math.floor(
      (order.amountCents * agent.commissionRateL1) / 10000
    );

    if (level1Amount > 0) {
      await tx.agentCommission.upsert({
        where: {
          agentId_orderId_level: {
            agentId: agent.id,
            orderId: order.id,
            level: "LEVEL_1"
          }
        },
        update: {},
        create: {
          agentId: agent.id,
          orderId: order.id,
          viewerAccountId: order.viewerAccountId,
          level: "LEVEL_1",
          amountCents: level1Amount
        }
      });
      await tx.agentAccount.update({
        where: { id: agent.id },
        data: {
          balanceCents: {
            increment: level1Amount
          }
        }
      });
    }

    const parent = agent.referredBy;

    if (!parent || parent.status !== "ACTIVE") {
      return;
    }

    const level2Amount = Math.floor(
      (order.amountCents * parent.commissionRateL2) / 10000
    );

    if (level2Amount > 0) {
      await tx.agentCommission.upsert({
        where: {
          agentId_orderId_level: {
            agentId: parent.id,
            orderId: order.id,
            level: "LEVEL_2"
          }
        },
        update: {},
        create: {
          agentId: parent.id,
          orderId: order.id,
          viewerAccountId: order.viewerAccountId,
          level: "LEVEL_2",
          amountCents: level2Amount
        }
      });
      await tx.agentAccount.update({
        where: { id: parent.id },
        data: {
          balanceCents: {
            increment: level2Amount
          }
        }
      });
    }
  }

  async listViewerOrders(query: ViewerOrderListQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const viewer = query.viewerKey
      ? await this.prisma.viewerAccount.findUnique({
          where: {
            viewerKey: query.viewerKey
          }
        })
      : null;
    if (query.viewerKey && !viewer) {
      return {
        page,
        pageSize,
        total: 0,
        items: []
      };
    }
    const where: Prisma.ViewerOrderWhereInput = viewer
      ? {
          viewerAccountId: viewer.id
        }
      : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.viewerOrder.findMany({
        where,
        include: {
          membershipPlan: true,
          contentItem: true,
          viewerAccount: true
        },
        orderBy: {
          createdAt: "desc"
        },
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      this.prisma.viewerOrder.count({ where })
    ]);

    return {
      page,
      pageSize,
      total,
      items
    };
  }

  async listContentConfigs(query: OperationListQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.contentItem.findMany({
        orderBy: {
          updatedAt: "desc"
        },
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      this.prisma.contentItem.count()
    ]);

    return {
      page,
      pageSize,
      total,
      items
    };
  }

  async listContentCatalog(query: ContentCatalogQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.ContentItemWhereInput = {
      publishState: PublishState.PUBLISHED,
      ...(query.keyword
        ? {
            OR: [
              {
                title: {
                  contains: query.keyword,
                  mode: "insensitive"
                }
              },
              {
                cloudVid: {
                  contains: query.keyword,
                  mode: "insensitive"
                }
              }
            ]
          }
        : {}),
      ...(query.accessType
        ? {
            accessType: query.accessType as ContentAccessType
          }
        : {})
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.contentItem.findMany({
        where,
        orderBy: {
          updatedAt: "desc"
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          orders: {
            select: {
              id: true
            }
          }
        }
      }),
      this.prisma.contentItem.count({ where })
    ]);

    return {
      page,
      pageSize,
      total,
      items: items.map((item) => ({
        id: item.id,
        title: item.title,
        cloudVid: item.cloudVid,
        accessType: item.accessType,
        previewDurationSec: item.previewDurationSec,
        priceCents: item.priceCents,
        publishState: item.publishState,
        updatedAt: item.updatedAt,
        orderCount: item.orders.length
      }))
    };
  }

  async getContentDetail(query: ContentDetailQueryDto) {
    const contentItem = await this.prisma.contentItem.findUnique({
      where: {
        cloudVid: query.cloudVid.trim()
      }
    });

    if (!contentItem || contentItem.publishState !== PublishState.PUBLISHED) {
      throw new NotFoundException("内容不存在或未上架");
    }

    const asset = await this.prisma.cloudMediaAsset.findUnique({
      where: {
        cloudVid: query.cloudVid.trim()
      }
    });

    const viewer = query.viewerKey?.trim()
      ? await this.prisma.viewerAccount.findUnique({
          where: {
            viewerKey: query.viewerKey.trim()
          },
          include: {
            memberships: true,
            entitlements: true
          }
        })
      : null;
    const nowUnix = this.nowUnix();
    const hasActiveMembership = Boolean(
      viewer?.memberships.find(
        (item) => item.status === MembershipStatus.ACTIVE && item.expiresAtUnix > nowUnix
      )
    );
    const hasEntitlement = Boolean(
      viewer?.entitlements.find(
        (item) =>
          item.contentItemId === contentItem.id &&
          (!item.expiresAtUnix || item.expiresAtUnix > nowUnix)
      )
    );
    const canPlay =
      contentItem.accessType === ContentAccessType.FREE ||
      (contentItem.accessType === ContentAccessType.VIP && hasActiveMembership) ||
      (contentItem.accessType === ContentAccessType.PAID && hasEntitlement);

    return {
      id: contentItem.id,
      title: contentItem.title,
      cloudVid: contentItem.cloudVid,
      accessType: contentItem.accessType,
      previewDurationSec: contentItem.previewDurationSec,
      priceCents: contentItem.priceCents,
      publishState: contentItem.publishState,
      updatedAt: contentItem.updatedAt,
      asset: asset
        ? {
            title: asset.title,
            categoryName: asset.categoryName,
            durationSec: Number(asset.durationSec),
            staticCoverUrl: asset.staticCoverUrl,
            gifCoverUrl: asset.gifCoverUrl,
            cloudSyncState: asset.cloudSyncState
          }
        : null,
      viewerAccess: {
        viewerKey: query.viewerKey?.trim() || null,
        hasActiveMembership,
        hasEntitlement,
        canPlay
      }
    };
  }

  async importCsv(payload: CsvImportDto) {
    const rows = this.parseCsv(payload.csvContent);
    const normalized = rows.map((row, index) => this.csvRowToResource(row, index + 1));
    const maxUpdatedAt = normalized.reduce(
      (acc, item) => Math.max(acc, item.updatedAt),
      0
    );

    const batch = await this.prisma.csvImportBatch.create({
      data: {
        sourceName: payload.sourceName,
        totalRows: normalized.length,
        summary: {
          source: "csv-manual-import"
        }
      }
    });

    try {
      await this.persistSync({
        items: normalized,
        maxUpdatedAt
      });

      await this.prisma.csvImportBatch.update({
        where: {
          id: batch.id
        },
        data: {
          status: CsvImportStatus.COMPLETED,
          successRows: normalized.length,
          failedRows: 0,
          summary: {
            source: "csv-manual-import",
            importedCloudVids: normalized.map((item) => item.vid)
          }
        }
      });

      return {
        batchId: batch.id,
        imported: normalized.length
      };
    } catch (error) {
      await this.prisma.csvImportBatch.update({
        where: {
          id: batch.id
        },
        data: {
          status: CsvImportStatus.FAILED,
          successRows: 0,
          failedRows: normalized.length,
          summary: {
            source: "csv-manual-import",
            error: error instanceof Error ? error.message : "unknown-error"
          }
        }
      });

      throw error;
    }
  }

  async listWebhookEvents(query: OperationListQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.cloudWebhookEvent.findMany({
        orderBy: {
          receivedAt: "desc"
        },
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      this.prisma.cloudWebhookEvent.count()
    ]);

    return {
      page,
      pageSize,
      total,
      items
    };
  }

  async listImportBatches(query: OperationListQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.csvImportBatch.findMany({
        orderBy: {
          createdAt: "desc"
        },
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      this.prisma.csvImportBatch.count()
    ]);

    return {
      page,
      pageSize,
      total,
      items
    };
  }

  private normalizeCloudResource(item: CloudResourceRecord): CloudResourceRecord {
    return {
      ...item,
      title: item.title.trim(),
      category: item.category.trim(),
      sourceMd5: item.sourceMd5.trim()
    };
  }

  private mapSyncState(item: CloudResourceRecord): SyncState {
    if (item.deleted) {
      return -1;
    }

    if (!item.available) {
      return 0;
    }

    return 1;
  }

  private toPrismaSyncState(item: CloudResourceRecord): CloudSyncState {
    const syncState = this.mapSyncState(item);

    if (syncState === -1) {
      return CloudSyncState.DELETED;
    }

    if (syncState === 0) {
      return CloudSyncState.OFFLINE;
    }

    return CloudSyncState.ACTIVE;
  }

  private async persistRenewedRows(rows: RenewResourceRow[]) {
    if (rows.length === 0) {
      return {
        updated: 0
      };
    }

    const nowUnix = this.nowUnix();

    await this.prisma.$transaction(
      rows.map((row) =>
        this.prisma.cloudMediaAsset.upsert({
          where: {
            cloudVid: row.vid
          },
          update: {
            cloudInternalId: row.id,
            title: row.title,
            cloudStatus: row.status,
            cloudSyncState: row.available
              ? CloudSyncState.ACTIVE
              : CloudSyncState.OFFLINE,
            hasStaticCover: row.hasStaticCover,
            hasGifCover: row.hasGifCover,
            staticCoverUrl: row.staticCoverUrl,
            gifCoverUrl: row.gifCoverUrl,
            resourceUrl: row.resourceUrl,
            resourceUrl2: row.resourceUrl2,
            playUrl: row.playUrl,
            urlExpiresAt: row.expiresAt,
            lastSyncedAt: nowUnix
          },
          create: {
            cloudVid: row.vid,
            cloudInternalId: row.id,
            title: row.title,
            cloudStatus: row.status,
            cloudSyncState: row.available
              ? CloudSyncState.ACTIVE
              : CloudSyncState.OFFLINE,
            publishState: PublishState.DRAFT,
            hasStaticCover: row.hasStaticCover,
            hasGifCover: row.hasGifCover,
            staticCoverUrl: row.staticCoverUrl,
            gifCoverUrl: row.gifCoverUrl,
            resourceUrl: row.resourceUrl,
            resourceUrl2: row.resourceUrl2,
            playUrl: row.playUrl,
            urlExpiresAt: row.expiresAt,
            lastSyncedAt: nowUnix
          }
        })
      )
    );

    return {
      updated: rows.length
    };
  }

  private async assertPlaybackAccess(
    contentItem: {
      id: string;
      accessType: ContentAccessType;
      title: string;
    },
    viewerKey?: string
  ) {
    if (contentItem.accessType === ContentAccessType.FREE) {
      return;
    }

    if (!viewerKey?.trim()) {
      throw new BadRequestException(
        contentItem.accessType === ContentAccessType.VIP
          ? "当前内容需要 VIP 才能观看"
          : "当前内容需要购买后才能观看"
      );
    }

    const viewer = await this.prisma.viewerAccount.findUnique({
      where: {
        viewerKey: viewerKey.trim()
      },
      include: {
        memberships: true,
        entitlements: true
      }
    });

    if (!viewer) {
      throw new NotFoundException("观看账号不存在，请先创建 viewerKey");
    }

    const nowUnix = this.nowUnix();

    if (contentItem.accessType === ContentAccessType.VIP) {
      const activeMembership = viewer.memberships.find(
        (item) =>
          item.status === MembershipStatus.ACTIVE && item.expiresAtUnix > nowUnix
      );

      if (!activeMembership) {
        throw new BadRequestException("当前内容需要有效 VIP 才能观看");
      }

      return;
    }

    const entitlement = viewer.entitlements.find(
      (item) =>
        item.contentItemId === contentItem.id &&
        (!item.expiresAtUnix || item.expiresAtUnix > nowUnix)
    );

    if (!entitlement) {
      throw new BadRequestException("当前内容尚未购买");
    }
  }

  private resolveWebhookEvent(payload: HandleWebhookDto): WebhookEventType {
    if (payload.event === "resourceDeleted") {
      return WebhookEventType.RESOURCE_DELETED;
    }

    if (payload.event === "resourceOffline") {
      return WebhookEventType.RESOURCE_OFFLINE;
    }

    return WebhookEventType.UNKNOWN;
  }

  private parseCsv(content: string): Record<string, string>[] {
    const lines = content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length < 2) {
      return [];
    }

    const headers = lines[0].split(",").map((item) => item.trim());

    return lines.slice(1).map((line) => {
      const columns = line.split(",").map((item) => item.trim());
      return headers.reduce<Record<string, string>>((acc, key, index) => {
        acc[key] = columns[index] ?? "";
        return acc;
      }, {});
    });
  }

  private csvRowToResource(
    row: Record<string, string>,
    lineNumber: number
  ): CloudResourceRecord {
    const vid = row.vid?.trim();
    const title = row.title?.trim();

    if (!vid || !title) {
      throw new Error(`CSV line ${lineNumber} missing vid or title`);
    }

    const timestamp = this.nowUnix();

    return {
      id: Number(row.id ?? 0),
      vid,
      title,
      status: Number(row.status ?? 0),
      available: row.available === "1" || row.available === "true",
      deleted: row.deleted === "1" || row.deleted === "true",
      duration: Number(row.duration ?? 0),
      size: Number(row.size ?? 0),
      category: row.category ?? "",
      sourceMd5: row.sourceMd5 ?? "",
      hasStaticCover: row.hasStaticCover === "1" || row.hasStaticCover === "true",
      hasGifCover: row.hasGifCover === "1" || row.hasGifCover === "true",
      createdAt: Number(row.createdAt ?? timestamp),
      updatedAt: Number(row.updatedAt ?? timestamp)
    };
  }

  private nowUnix() {
    return Math.floor(Date.now() / 1000);
  }

  private generateOrderNo(prefix: string) {
    return `${prefix}${Date.now()}${Math.floor(Math.random() * 100000)
      .toString()
      .padStart(5, "0")}`;
  }

  private chunk<T>(items: T[], size: number): T[][] {
    const result: T[][] = [];

    for (let index = 0; index < items.length; index += size) {
      result.push(items.slice(index, index + size));
    }

    return result;
  }
}
