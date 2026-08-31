import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { resolve } from "node:path";

import { AdminAuthModule } from "./admin-auth/admin-auth.module";
import { AgentsModule } from "./agents/agents.module";
import { HealthModule } from "./health/health.module";
import { MediaIngestionModule } from "./media-ingestion/media-ingestion.module";
import { PrismaModule } from "./prisma/prisma.module";
import { PaymentsModule } from "./payments/payments.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        resolve(process.cwd(), ".env"),
        resolve(process.cwd(), "../../.env")
      ]
    }),
    AdminAuthModule,
    AgentsModule,
    PrismaModule,
    HealthModule,
    MediaIngestionModule,
    PaymentsModule
  ]
})
export class AppModule {}
