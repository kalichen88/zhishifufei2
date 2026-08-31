import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateNested
} from "class-validator";

export class SignPostBodyDto {
  @IsString()
  @IsNotEmpty()
  rawBody!: string;
}

export class VerifyWebhookDto {
  @IsString()
  event!: string;

  @Type(() => Number)
  @IsInt()
  id!: number;

  @IsString()
  vid!: string;

  @Type(() => Number)
  @IsInt()
  ts!: number;

  @IsString()
  sign!: string;
}

export class PreviewSyncItemDto {
  @Type(() => Number)
  @IsInt()
  id!: number;

  @IsString()
  vid!: string;

  @IsString()
  title!: string;

  @Type(() => Number)
  @IsInt()
  status!: number;

  @IsBoolean()
  available!: boolean;

  @IsBoolean()
  deleted!: boolean;

  @Type(() => Number)
  @IsNumber()
  duration!: number;

  @Type(() => Number)
  @IsNumber()
  size!: number;

  @IsString()
  category!: string;

  @IsString()
  sourceMd5!: string;

  @IsBoolean()
  hasStaticCover!: boolean;

  @IsBoolean()
  hasGifCover!: boolean;

  @Type(() => Number)
  @IsInt()
  createdAt!: number;

  @Type(() => Number)
  @IsInt()
  updatedAt!: number;
}

export class PreviewSyncBatchDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => PreviewSyncItemDto)
  items!: PreviewSyncItemDto[];
}

export class RenewPlanDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @IsString({ each: true })
  vids!: string[];

  @Type(() => Number)
  @IsInt()
  @Min(60)
  @Max(2592000)
  ttl!: number;

  @IsOptional()
  @IsString()
  @IsIn(["primary", "per-video"])
  domain?: string;
}

export class PersistSyncBatchDto extends PreviewSyncBatchDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxUpdatedAt!: number;
}

export class MediaAssetListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;

  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsString()
  categoryName?: string;

  @IsOptional()
  @IsIn(["ACTIVE", "OFFLINE", "DELETED"])
  syncState?: "ACTIVE" | "OFFLINE" | "DELETED";
}

export class HandleWebhookDto extends VerifyWebhookDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  status?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  deleted?: number;
}

export class CsvImportDto {
  @IsString()
  @MinLength(1)
  sourceName!: string;

  @IsString()
  @MinLength(1)
  csvContent!: string;
}

export class SyncRemoteResourcesDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  updatedAfter?: number = 0;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize?: number = 100;

  @IsOptional()
  @IsBoolean()
  includeDeleted?: boolean = true;

  @IsOptional()
  @IsBoolean()
  persist?: boolean = true;
}

export class RenewRemoteUrlsDto extends RenewPlanDto {
  @IsOptional()
  @IsBoolean()
  persist?: boolean = true;
}

export class PlaybackAuthorizeDto {
  @IsString()
  @MinLength(1)
  cloudVid!: string;

  @IsOptional()
  @IsString()
  viewerKey?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(60)
  @Max(2592000)
  ttl?: number = 3600;

  @IsOptional()
  @IsString()
  @IsIn(["primary", "per-video"])
  domain?: string = "primary";

  @IsOptional()
  @IsBoolean()
  forceRefresh?: boolean = false;
}

export class OperationListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;
}

export class UpsertContentConfigDto {
  @IsString()
  @MinLength(1)
  cloudVid!: string;

  @IsString()
  @MinLength(1)
  title!: string;

  @IsString()
  @IsIn(["FREE", "VIP", "PAID"])
  accessType!: "FREE" | "VIP" | "PAID";

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  previewDurationSec?: number = 0;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  priceCents?: number = 0;

  @IsOptional()
  @IsString()
  @IsIn(["DRAFT", "REVIEWING", "PUBLISHED", "UNPUBLISHED"])
  publishState?: "DRAFT" | "REVIEWING" | "PUBLISHED" | "UNPUBLISHED" = "PUBLISHED";
}

export class ViewerAccountDto {
  @IsString()
  @MinLength(1)
  viewerKey!: string;

  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsString()
  referralCode?: string;
}

export class GrantMembershipDto extends ViewerAccountDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  expiresAtUnix!: number;
}

export class GrantPurchaseDto extends ViewerAccountDto {
  @IsString()
  @MinLength(1)
  cloudVid!: string;

  @IsOptional()
  @IsString()
  source?: string = "manual";

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  expiresAtUnix?: number;
}

export class UpsertMembershipPlanDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  durationDays!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  priceCents!: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;
}

export class CreateMembershipOrderDto extends ViewerAccountDto {
  @IsString()
  @MinLength(1)
  membershipPlanId!: string;
}

export class CreateContentOrderDto extends ViewerAccountDto {
  @IsString()
  @MinLength(1)
  cloudVid!: string;
}

export class CompleteOrderDto {
  @IsString()
  @MinLength(1)
  orderNo!: string;
}

export class ViewerOrderListQueryDto extends OperationListQueryDto {
  @IsOptional()
  @IsString()
  viewerKey?: string;
}

export class ViewerProfileQueryDto {
  @IsString()
  @MinLength(1)
  viewerKey!: string;
}

export class ContentCatalogQueryDto extends OperationListQueryDto {
  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsString()
  @IsIn(["FREE", "VIP", "PAID"])
  accessType?: "FREE" | "VIP" | "PAID";
}

export class ContentDetailQueryDto {
  @IsString()
  @MinLength(1)
  cloudVid!: string;

  @IsOptional()
  @IsString()
  viewerKey?: string;
}
