import { logInSchema, signUpSchema } from "@docket/contracts";
import { type RequestHandler, Router } from "express";

import {
  rateLimiter,
  type RateLimitSettings,
} from "../../shared/middleware/rate-limit.middleware.js";
import { validate } from "../../shared/middleware/validate.middleware.js";
import type { AuthController } from "./auth.controller.js";
import { AUTH_RATE_LIMITS } from "./auth.rate-limits.js";

export function authRoutes(
  controller: AuthController,
  authenticate: RequestHandler,
  rateLimits: RateLimitSettings,
): Router {
  const router = Router();
  const limit = (rule: keyof typeof AUTH_RATE_LIMITS) =>
    rateLimiter(AUTH_RATE_LIMITS[rule], rateLimits);

  // Limits run after validation so account keys use the normalised email.
  router.post(
    "/signup",
    validate({ body: signUpSchema }),
    limit("signUpPerIp"),
    limit("signUpPerEmail"),
    controller.signUp,
  );
  router.post(
    "/login",
    validate({ body: logInSchema }),
    limit("loginPerIp"),
    limit("loginPerAccount"),
    controller.logIn,
  );
  router.post("/refresh", controller.refresh);
  router.post("/logout", controller.logOut);
  router.get("/me", authenticate, controller.me);
  router.get("/providers", controller.providers);

  return router;
}
