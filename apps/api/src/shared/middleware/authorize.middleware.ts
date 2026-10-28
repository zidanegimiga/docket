import type { Permission } from "@docket/contracts";
import type { RequestHandler } from "express";

import { ForbiddenError } from "../errors/forbidden.error.js";
import { principalOf } from "./authenticate.middleware.js";

/**
 * A guard reads only req.principal, so it fits any route. Express infers a route's request types
 * from its first handler, which is why the guard does not pin them down.
 */
export type Guard = RequestHandler<any, any, any, any>;

/** Allows the request when the caller holds the permission. Use after authenticate(). */
export function requirePermission(permission: Permission): Guard {
  return requireAnyPermission(permission);
}

/**
 * Allows the request when the caller holds at least one of the permissions, for routes whose
 * finer rules (such as ownership) are applied by the service.
 */
export function requireAnyPermission(...permissions: Permission[]): Guard {
  return (req, _res, next) => {
    const { status, permissions: granted } = principalOf(req);

    // Pending users hold no permissions; a specific code lets the client explain why.
    if (status === "pending") {
      throw new ForbiddenError(
        "ACCOUNT_PENDING",
        "Your account is waiting for an administrator's approval",
      );
    }
    if (!permissions.some((permission) => granted.includes(permission))) {
      throw new ForbiddenError("PERMISSION_DENIED", "You do not have permission to do this");
    }

    next();
  };
}
