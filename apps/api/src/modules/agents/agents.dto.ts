import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength
} from "class-validator";

export class CreateAgentDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(32)
  username!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  @MaxLength(64)
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  displayName?: string;

  // 万分比：3000 = 30%
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10000)
  commissionRateL1?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10000)
  commissionRateL2?: number;

  @IsOptional()
  @IsString()
  referredByAgentId?: string;
}

export class UpdateAgentDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  displayName?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10000)
  commissionRateL1?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10000)
  commissionRateL2?: number;

  @IsOptional()
  @IsIn(["ACTIVE", "DISABLED"])
  status?: "ACTIVE" | "DISABLED";
}

export class ResetAgentPasswordDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  @MaxLength(64)
  password!: string;
}

export class AgentWithdrawalRequestDto {
  @Type(() => Number)
  @IsInt()
  @Min(1000)
  amountCents!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  accountInfo!: string;
}

export class ReviewWithdrawalDto {
  @IsString()
  @IsNotEmpty()
  withdrawalId!: string;

  @IsIn(["APPROVED", "REJECTED"])
  action!: "APPROVED" | "REJECTED";

  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}
