import type { Router } from "express";

import type { DatabaseProvider } from "../../core/database/database.interface.js";
import type { Identity } from "../../core/identity/identity.js";
import type { Logger } from "../../core/logger/logger.interface.js";
import type { Monitor } from "../../core/monitoring/monitor.interface.js";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { AuthController } from "./auth.controller.js";
import { authRoutes } from "./auth.routes.js";
import { AccessService } from "./access.service.js";
import { AuthService } from "./auth.service.js";
import type { SessionCookieSettings } from "./session-cookies.js";
import { PrismaRefreshTokenRepository } from "./session.repository.js";
import { PrismaUserRepository } from "./user.repository.js";

export interface IdentityModuleDeps {
  database: DatabaseProvider<PrismaClient>;
  monitor: Monitor;
  identity: Identity;
  logger: Logger;
  cookies: SessionCookieSettings;
  refreshTokenTtlDays: number;
  refreshReuseGraceSeconds: number;
}

export function createIdentityModule({
  database,
  monitor,
  identity,
  logger,
  cookies,
  refreshTokenTtlDays,
  refreshReuseGraceSeconds,
}: IdentityModuleDeps): Router {
  const users = new PrismaUserRepository(database.client);
  const authService = new AuthService({
    users,
    refreshTokens: new PrismaRefreshTokenRepository(database.client),
    access: new AccessService(users, logger),
    passwordHasher: identity.passwordHasher,
    tokenIssuer: identity.tokenIssuer,
    emailSender: identity.emailSender,
    monitor,
    refreshTokenTtlDays,
    refreshReuseGraceSeconds,
  });

  return authRoutes(new AuthController(authService, cookies));
}
