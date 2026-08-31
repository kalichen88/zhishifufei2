import { Module } from "@nestjs/common";

import { CloudResourceClient } from "./cloud-resource.client";
import { MediaIngestionController } from "./media-ingestion.controller";
import { MediaIngestionService } from "./media-ingestion.service";

@Module({
  controllers: [MediaIngestionController],
  providers: [CloudResourceClient, MediaIngestionService],
  exports: [MediaIngestionService]
})
export class MediaIngestionModule {}
