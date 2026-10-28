import { PERMISSIONS, type UpdateRoleBody } from "@docket/contracts";

import { ConflictError } from "../../shared/errors/conflict.error.js";
import { ADMIN_ROLE } from "./admin-promotion.js";
import type { AdminRoleRecord } from "./admin-roles.types.js";

const holdsWholeCatalog = (permissions: readonly string[]) =>
  PERMISSIONS.every((permission) => permissions.includes(permission));

/**
 * Built-in roles keep their names because code and migrations refer to them, and admin always
 * holds every permission so someone can always manage users and roles.
 */
export function assertRoleUpdateAllowed(role: AdminRoleRecord, change: UpdateRoleBody): void {
  if (role.isSystem && change.name !== undefined && change.name !== role.name) {
    throw new ConflictError("SYSTEM_ROLE", "Built-in roles cannot be renamed");
  }
  if (role.name === ADMIN_ROLE && change.permissions && !holdsWholeCatalog(change.permissions)) {
    throw new ConflictError("SYSTEM_ROLE", "The admin role always holds every permission");
  }
}

export function assertRoleDeletable(role: AdminRoleRecord): void {
  if (role.isSystem) {
    throw new ConflictError("SYSTEM_ROLE", "Built-in roles cannot be deleted");
  }
  if (role.userCount > 0) {
    throw new ConflictError(
      "ROLE_IN_USE",
      `This role is held by ${role.userCount} ${role.userCount === 1 ? "person" : "people"}. Remove it from them first.`,
    );
  }
}
