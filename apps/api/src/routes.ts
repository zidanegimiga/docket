import { Router } from "express";

import type { DatabaseProvider } from "./core/database/database.interface.js";
import type { Identity } from "./core/identity/identity.js";
import type { Logger } from "./core/logger/logger.interface.js";
import type { Monitor } from "./core/monitoring/monitor.interface.js";
import type { PrismaClient } from "./generated/prisma/client.js";
import { createHealthModule } from "./modules/health/index.js";
import { createIdentityModule } from "./modules/identity/index.js";
import type { SessionCookieSettings } from "./modules/identity/session-cookies.js";
import { createTicketModule } from "./modules/tickets/index.js";

export interface RouterDeps {
  database: DatabaseProvider<PrismaClient>;
  monitor: Monitor;
  identity: Identity;
  logger: Logger;
  cookies: SessionCookieSettings;
  refreshTokenTtlDays: number;
  refreshReuseGraceSeconds: number;
}

export function createRouter(deps: RouterDeps): Router {
  const { database, monitor } = deps;
  const router = Router();

  router.use("/health", createHealthModule({ database }));
  router.use("/tickets", createTicketModule({ database, monitor }));
  router.use("/auth", createIdentityModule(deps));

  return router;
}
