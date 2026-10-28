import { listUsersQuerySchema, updateUserSchema } from "@docket/contracts";
import { type RequestHandler, Router } from "express";

import { requirePermission } from "../../shared/middleware/authorize.middleware.js";
import { validate } from "../../shared/middleware/validate.middleware.js";
import type { AdminRoleController } from "./admin-roles.controller.js";
import type { AdminUserController } from "./admin-users.controller.js";
import { userIdParamsSchema } from "./admin-users.schemas.js";

export interface AdminControllers {
  users: AdminUserController;
  roles: AdminRoleController;
}

export function adminRoutes(
  { users, roles }: AdminControllers,
  authenticate: RequestHandler,
): Router {
  const router = Router();

  router.use(authenticate);

  router.get(
    "/users",
    requirePermission("users:read"),
    validate({ query: listUsersQuerySchema }),
    users.list,
  );
  router.patch(
    "/users/:id",
    requirePermission("users:manage"),
    validate({ params: userIdParamsSchema, body: updateUserSchema }),
    users.update,
  );

  // Anyone who can see users can see the roles they hold; changing roles needs roles:manage.
  router.get("/roles", requirePermission("users:read"), roles.list);

  return router;
}
