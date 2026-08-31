import { Module } from "@nestjs/common";

import { MediaIngestionModule } from "../media-ingestion/media-ingestion.module";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";

@Module({
  imports: [MediaIngestionModule],
  controllers: [PaymentsController],
  providers: [PaymentsService]
})
export class PaymentsModule {}
