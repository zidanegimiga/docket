import { logInSchema, signUpSchema } from "@docket/contracts";
import { type RequestHandler, Router } from "express";

import { validate } from "../../shared/middleware/validate.middleware.js";
import type { AuthController } from "./auth.controller.js";

export function authRoutes(controller: AuthController, authenticate: RequestHandler): Router {
  const router = Router();

  router.post("/signup", validate({ body: signUpSchema }), controller.signUp);
  router.post("/login", validate({ body: logInSchema }), controller.logIn);
  router.post("/refresh", controller.refresh);
  router.post("/logout", controller.logOut);
  router.get("/me", authenticate, controller.me);
  router.get("/providers", controller.providers);

  return router;
}
