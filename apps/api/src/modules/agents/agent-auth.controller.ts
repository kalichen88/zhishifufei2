import { Body, Controller, Post } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { IsNotEmpty, IsString, MinLength, MaxLength } from "class-validator";

import { AgentsService } from "./agents.service";

export class AgentLoginDto {
  @IsString()
  @IsNotEmpty()
  username!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  @MaxLength(64)
  password!: string;
}

@Controller("agent-auth")
export class AgentAuthController {
  constructor(
    private readonly agentsService: AgentsService,
    private readonly jwtService: JwtService
  ) {}

  @Post("login")
  async login(@Body() payload: AgentLoginDto) {
    return this.agentsService.agentLogin(
      payload.username,
      payload.password,
      (tokenPayload) => this.jwtService.signAsync(tokenPayload)
    );
  }
}
