import { Body, Controller, Post } from "@nestjs/common";

import { AdminLoginDto } from "./admin-auth.dto";
import { AdminAuthService } from "./admin-auth.service";

@Controller("admin-auth")
export class AdminAuthController {
  constructor(private readonly adminAuthService: AdminAuthService) {}

  @Post("login")
  async login(@Body() payload: AdminLoginDto) {
    return this.adminAuthService.login(payload);
  }
}
