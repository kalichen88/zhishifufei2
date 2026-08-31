import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";

import { AdminAuthGuard } from "../admin-auth/admin-auth.guard";
import { Public } from "../admin-auth/public.decorator";
import {
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
  SignPostBodyDto,
  SyncRemoteResourcesDto,
  UpsertContentConfigDto,
  UpsertMembershipPlanDto,
  VerifyWebhookDto,
  ViewerProfileQueryDto,
  ViewerOrderListQueryDto
} from "./media-ingestion.dto";
import { MediaIngestionService } from "./media-ingestion.service";

@Controller("media-ingestion")
@UseGuards(AdminAuthGuard)
export class MediaIngestionController {
  constructor(private readonly mediaIngestionService: MediaIngestionService) {}

  @Get("sign-get")
  signGet(@Query("ts") ts?: string) {
    const unixTs = Number(ts ?? Math.floor(Date.now() / 1000));
    return this.mediaIngestionService.signGetRequest(unixTs);
  }

  @Post("sign-post")
  signPost(@Body() body: SignPostBodyDto) {
    const unixTs = Math.floor(Date.now() / 1000);
    return this.mediaIngestionService.signPostRequest(unixTs, body.rawBody);
  }

  @Post("verify-webhook")
  verifyWebhook(@Body() body: VerifyWebhookDto) {
    return this.mediaIngestionService.verifyWebhook(body);
  }

  @Post("preview-sync")
  previewSync(@Body() body: PreviewSyncBatchDto) {
    return this.mediaIngestionService.previewSync(body);
  }

  @Post("persist-sync")
  persistSync(@Body() body: PersistSyncBatchDto) {
    return this.mediaIngestionService.persistSync(body);
  }

  @Post("sync-remote")
  syncRemoteResources(@Body() body: SyncRemoteResourcesDto) {
    return this.mediaIngestionService.syncRemoteResources(body);
  }

  @Post("renew-plan")
  renewPlan(@Body() body: RenewPlanDto) {
    return this.mediaIngestionService.buildRenewPlan(body);
  }

  @Post("renew-remote")
  renewRemoteUrls(@Body() body: RenewRemoteUrlsDto) {
    return this.mediaIngestionService.renewRemoteUrls(body);
  }

  @Get("assets")
  listAssets(@Query() query: MediaAssetListQueryDto) {
    return this.mediaIngestionService.listAssets(query);
  }

  @Post("webhook")
  @Public()
  handleWebhook(@Body() body: HandleWebhookDto) {
    return this.mediaIngestionService.handleWebhook(body);
  }

  @Post("import-csv")
  importCsv(@Body() body: CsvImportDto) {
    return this.mediaIngestionService.importCsv(body);
  }

  @Post("playback-authorize")
  @Public()
  authorizePlayback(@Body() body: PlaybackAuthorizeDto) {
    return this.mediaIngestionService.authorizePlayback(body);
  }

  @Post("content-config")
  upsertContentConfig(@Body() body: UpsertContentConfigDto) {
    return this.mediaIngestionService.upsertContentConfig(body);
  }

  @Get("content-configs")
  listContentConfigs(@Query() query: OperationListQueryDto) {
    return this.mediaIngestionService.listContentConfigs(query);
  }

  @Get("content-catalog")
  @Public()
  listContentCatalog(@Query() query: ContentCatalogQueryDto) {
    return this.mediaIngestionService.listContentCatalog(query);
  }

  @Get("content-detail")
  @Public()
  getContentDetail(@Query() query: ContentDetailQueryDto) {
    return this.mediaIngestionService.getContentDetail(query);
  }

  @Post("grant-membership")
  grantMembership(@Body() body: GrantMembershipDto) {
    return this.mediaIngestionService.grantMembership(body);
  }

  @Post("grant-purchase")
  grantPurchase(@Body() body: GrantPurchaseDto) {
    return this.mediaIngestionService.grantPurchase(body);
  }

  @Post("membership-plan")
  upsertMembershipPlan(@Body() body: UpsertMembershipPlanDto) {
    return this.mediaIngestionService.upsertMembershipPlan(body);
  }

  @Get("membership-plans")
  @Public()
  listMembershipPlans(@Query() query: OperationListQueryDto) {
    return this.mediaIngestionService.listMembershipPlans(query);
  }

  @Get("viewer-profile")
  @Public()
  getViewerProfile(@Query() query: ViewerProfileQueryDto) {
    return this.mediaIngestionService.getViewerProfile(query);
  }

  @Post("orders/membership")
  @Public()
  createMembershipOrder(@Body() body: CreateMembershipOrderDto) {
    return this.mediaIngestionService.createMembershipOrder(body);
  }

  @Post("orders/content")
  @Public()
  createContentOrder(@Body() body: CreateContentOrderDto) {
    return this.mediaIngestionService.createContentOrder(body);
  }

  @Post("orders/complete")
  @Public()
  completeOrder(@Body() body: CompleteOrderDto) {
    return this.mediaIngestionService.completeOrder(body);
  }

  @Get("orders")
  @Public()
  listViewerOrders(@Query() query: ViewerOrderListQueryDto) {
    return this.mediaIngestionService.listViewerOrders(query);
  }

  @Get("webhook-events")
  listWebhookEvents(@Query() query: OperationListQueryDto) {
    return this.mediaIngestionService.listWebhookEvents(query);
  }

  @Get("import-batches")
  listImportBatches(@Query() query: OperationListQueryDto) {
    return this.mediaIngestionService.listImportBatches(query);
  }
}
