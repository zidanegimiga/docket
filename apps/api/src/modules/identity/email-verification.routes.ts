import { Router } from "express";

import type { EmailVerificationController } from "./email-verification.controller.js";

export function emailVerificationRoutes(controller: EmailVerificationController): Router {
  const router = Router();

  router.get("/", controller.verify);

  return router;
}
