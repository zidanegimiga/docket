import type { Router } from "express";

import type { DatabaseProvider } from "../../core/database/database.interface.js";
import type { Identity } from "../../core/identity/identity.js";
import type { Logger } from "../../core/logger/logger.interface.js";
import type { Monitor } from "../../core/monitoring/monitor.interface.js";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { AuthController } from "./auth.controller.js";
import { authRoutes } from "./auth.routes.js";
import { AuthService } from "./auth.service.js";
import { PrismaUserRepository } from "./user.repository.js";

export interface IdentityModuleDeps {
  database: DatabaseProvider<PrismaClient>;
  monitor: Monitor;
  identity: Identity;
  logger: Logger;
}

export function createIdentityModule({ database, monitor, identity }: IdentityModuleDeps): Router {
  const users = new PrismaUserRepository(database.client);
  const authService = new AuthService(
    users,
    identity.passwordHasher,
    identity.emailSender,
    monitor,
  );

  return authRoutes(new AuthController(authService));
}
