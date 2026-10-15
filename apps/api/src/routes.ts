import { Router } from "express";

import type { DatabaseProvider } from "./core/database/database.interface.js";
import type { Monitor } from "./core/monitoring/monitor.interface.js";
import type { PrismaClient } from "./generated/prisma/client.js";
import { createHealthModule } from "./modules/health/index.js";
import { createTicketModule } from "./modules/tickets/index.js";

export interface RouterDeps {
  database: DatabaseProvider<PrismaClient>;
  monitor: Monitor;
}

export function createRouter({ database, monitor }: RouterDeps): Router {
  const router = Router();

  router.use("/health", createHealthModule({ database }));
  router.use("/tickets", createTicketModule({ database, monitor }));

  return router;
}
