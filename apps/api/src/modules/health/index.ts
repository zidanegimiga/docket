import type { Router } from "express";

import type { DatabaseProvider } from "../../core/database/database.interface.js";
import { HealthController } from "./health.controller.js";
import { healthRoutes } from "./health.routes.js";
import { HealthService } from "./health.service.js";

export interface HealthModuleDeps {
  database: DatabaseProvider<unknown>;
}

export function createHealthModule({ database }: HealthModuleDeps): Router {
  const service = new HealthService(database);
  const controller = new HealthController(service);

  return healthRoutes(controller);
}
