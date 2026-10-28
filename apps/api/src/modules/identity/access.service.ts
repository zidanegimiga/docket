import { PERMISSIONS, type Permission, type UserStatus } from "@docket/contracts";

import type { Logger } from "../../core/logger/logger.interface.js";
import type { UserAccess, UserRepository } from "./user.types.js";

export interface ResolvedAccess {
  userId: string;
  status: UserStatus;
  permissions: Permission[];
}

export interface EffectivePermissions {
  permissions: Permission[];
  /** Stored names missing from the catalog, such as a permission removed from the code. */
  unknown: string[];
}

/**
 * The permissions a user actually holds: the union of their roles and direct grants, in catalog
 * order, and none at all unless the account is active.
 */
export function effectivePermissions({
  status,
  rolePermissions,
  directPermissions,
}: UserAccess): EffectivePermissions {
  const granted = new Set([...rolePermissions, ...directPermissions]);
  const unknown = [...granted].filter((name) => !(PERMISSIONS as readonly string[]).includes(name));
  const permissions =
    status === "active" ? PERMISSIONS.filter((permission) => granted.has(permission)) : [];
  return { permissions, unknown };
}

export class AccessService {
  constructor(
    private readonly users: UserRepository,
    private readonly logger: Logger,
  ) {}

  async resolve(userId: string): Promise<ResolvedAccess | null> {
    const access = await this.users.findAccess(userId);
    if (!access) return null;

    const { permissions, unknown } = effectivePermissions(access);
    if (access.status === "active" && unknown.length > 0) {
      this.logger.warn("Ignoring stored permissions that are not in the catalog", {
        userId,
        unknown,
      });
    }

    return { userId, status: access.status, permissions };
  }
}
