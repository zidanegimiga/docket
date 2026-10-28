import { Router } from "express";

import type { OAuthController } from "./oauth.controller.js";

export function oauthRoutes(controller: OAuthController): Router {
  const router = Router();

  router.get("/:provider", controller.start);
  router.get("/:provider/callback", controller.callback);

  return router;
}
