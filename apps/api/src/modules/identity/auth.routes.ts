import { signUpSchema } from "@docket/contracts";
import { Router } from "express";

import { validate } from "../../shared/middleware/validate.middleware.js";
import type { AuthController } from "./auth.controller.js";

export function authRoutes(controller: AuthController): Router {
  const router = Router();

  router.post("/signup", validate({ body: signUpSchema }), controller.signUp);

  return router;
}
