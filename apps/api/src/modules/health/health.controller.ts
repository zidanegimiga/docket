import type { RequestHandler } from "express";

import type { HealthService } from "./health.service.js";

export class HealthController {
  constructor(private readonly service: HealthService) {}

  check: RequestHandler = async (_req, res) => {
    const health = await this.service.check();
    res.status(health.status === "ok" ? 200 : 503).json(health);
  };
}
