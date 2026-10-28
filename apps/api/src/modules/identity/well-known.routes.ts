import { Router } from "express";

import type { WellKnownController } from "./well-known.controller.js";

export function wellKnownRoutes(controller: WellKnownController): Router {
  const router = Router();

  router.get("/jwks.json", controller.jwks);

  return router;
}
