import { Router } from "express";

import type { DatabaseProvider } from "./core/database/database.interface.js";
import { createHealthModule } from "./modules/health/index.js";

export interface RouterDeps {
  database: DatabaseProvider<unknown>;
}

export function createRouter({ database }: RouterDeps): Router {
  const router = Router();

  router.use("/health", createHealthModule({ database }));

  return router;
}
