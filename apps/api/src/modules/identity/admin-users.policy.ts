import type { Principal } from "../../core/identity/principal.js";
import { ConflictError } from "../../shared/errors/conflict.error.js";
import { ValidationError } from "../../shared/errors/validation.error.js";
import { effectivePermissions } from "./access.service.js";
import { ADMIN_ROLE } from "./admin-promotion.js";
import type { AccessChangeSnapshot } from "./admin-users.types.js";

const isActiveAdmin = (status: string, roles: { name: string }[]) =>
  status === "active" && roles.some((role) => role.name === ADMIN_ROLE);

/**
 * Refuses access changes that would lock people out: administrators cannot disable themselves or
 * take away their own ability to manage users, and the last active administrator stays one.
 */
export function assertAccessChangeAllowed(actor: Principal, snapshot: AccessChangeSnapshot): void {
  const { before, after, unknownRoleIds, otherActiveAdmins } = snapshot;

  if (unknownRoleIds.length > 0) {
    throw new ValidationError([
      { path: "body.roleIds", message: "One or more roles do not exist" },
    ]);
  }

  if (before.id === actor.userId) {
    if (after.status !== "active") {
      throw new ConflictError("CANNOT_CHANGE_OWN_ACCESS", "You cannot disable your own account");
    }
    const { permissions } = effectivePermissions({
      status: after.status,
      rolePermissions: after.roles.flatMap((role) => role.permissions),
      directPermissions: after.directPermissions,
    });
    if (!permissions.includes("users:manage")) {
      throw new ConflictError(
        "CANNOT_CHANGE_OWN_ACCESS",
        "You cannot remove your own permission to manage users",
      );
    }
  }

  const losesAdmin =
    isActiveAdmin(before.status, before.roles) && !isActiveAdmin(after.status, after.roles);
  if (losesAdmin && otherActiveAdmins === 0) {
    throw new ConflictError("LAST_ADMIN", "At least one active administrator must remain");
  }
}
