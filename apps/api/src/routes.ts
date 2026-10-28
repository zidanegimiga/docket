import { Router } from "express";

import type { DatabaseProvider } from "./core/database/database.interface.js";
import type { Identity } from "./core/identity/identity.js";
import type { Logger } from "./core/logger/logger.interface.js";
import type { Monitor } from "./core/monitoring/monitor.interface.js";
import type { PrismaClient } from "./generated/prisma/client.js";
import { createHealthModule } from "./modules/health/index.js";
import { createIdentityModule } from "./modules/identity/index.js";
import { createTicketModule } from "./modules/tickets/index.js";

export interface RouterDeps {
  database: DatabaseProvider<PrismaClient>;
  monitor: Monitor;
  identity: Identity;
  logger: Logger;
}

export function createRouter({ database, monitor, identity, logger }: RouterDeps): Router {
  const router = Router();

  router.use("/health", createHealthModule({ database }));
  router.use("/tickets", createTicketModule({ database, monitor }));
  router.use("/auth", createIdentityModule({ database, monitor, identity, logger }));

  return router;
}
