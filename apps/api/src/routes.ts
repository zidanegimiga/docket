import { Router } from "express";

import type { DatabaseProvider } from "./core/database/database.interface.js";
import type { Identity } from "./core/identity/identity.js";
import type { Logger } from "./core/logger/logger.interface.js";
import type { Monitor } from "./core/monitoring/monitor.interface.js";
import type { PrismaClient } from "./generated/prisma/client.js";
import { createHealthModule } from "./modules/health/index.js";
import { createIdentityModule } from "./modules/identity/index.js";
import {
  sessionCookieNames,
  type SessionCookieSettings,
} from "./modules/identity/session-cookies.js";
import { createTicketModule } from "./modules/tickets/index.js";
import { authenticate } from "./shared/middleware/authenticate.middleware.js";

export interface RouterDeps {
  database: DatabaseProvider<PrismaClient>;
  monitor: Monitor;
  identity: Identity;
  logger: Logger;
  cookies: SessionCookieSettings;
  webOrigin: string;
  refreshTokenTtlDays: number;
  refreshReuseGraceSeconds: number;
}

export function createRouter(deps: RouterDeps): Router {
  const { database, monitor, identity, cookies } = deps;
  const router = Router();
  const identityModule = createIdentityModule({
    ...deps,
    authenticate: authenticate({
      resolver: identity.principalResolver,
      accessCookieName: sessionCookieNames(cookies.secure).access,
    }),
  });

  router.use("/health", createHealthModule({ database }));
  router.use("/tickets", createTicketModule({ database, monitor }));
  router.use("/auth", identityModule.auth);
  router.use("/.well-known", identityModule.wellKnown);

  return router;
}
