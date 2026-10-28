import { listUsersQuerySchema } from "@docket/contracts";
import { type RequestHandler, Router } from "express";

import { requirePermission } from "../../shared/middleware/authorize.middleware.js";
import { validate } from "../../shared/middleware/validate.middleware.js";
import type { AdminUserController } from "./admin-users.controller.js";

export function adminRoutes(users: AdminUserController, authenticate: RequestHandler): Router {
  const router = Router();

  router.use(authenticate);

  router.get(
    "/users",
    requirePermission("users:read"),
    validate({ query: listUsersQuerySchema }),
    users.list,
  );

  return router;
}
