import { Global, Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";

import { AdminAuthController } from "./admin-auth.controller";
import { AdminAuthGuard } from "./admin-auth.guard";
import { AdminAuthService } from "./admin-auth.service";

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: process.env.ADMIN_JWT_SECRET ?? "dev-admin-jwt-secret",
        signOptions: { expiresIn: "12h" }
      })
    })
  ],
  controllers: [AdminAuthController],
  providers: [AdminAuthService, AdminAuthGuard],
  exports: [AdminAuthService, AdminAuthGuard, JwtModule]
})
export class AdminAuthModule {}
