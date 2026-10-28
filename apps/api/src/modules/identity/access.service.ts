import { PERMISSIONS, type Permission, type UserStatus } from "@docket/contracts";

import type { Logger } from "../../core/logger/logger.interface.js";
import type { UserRepository } from "./user.types.js";

export interface ResolvedAccess {
  userId: string;
  status: UserStatus;
  permissions: Permission[];
}

export class AccessService {
  constructor(
    private readonly users: UserRepository,
    private readonly logger: Logger,
  ) {}

  async resolve(userId: string): Promise<ResolvedAccess | null> {
    const access = await this.users.findAccess(userId);
    if (!access) return null;

    if (access.status !== "active") {
      return { userId, status: access.status, permissions: [] };
    }

    const granted = new Set([...access.rolePermissions, ...access.directPermissions]);
    const permissions = PERMISSIONS.filter((permission) => granted.has(permission));

    const unknown = [...granted].filter(
      (name) => !(PERMISSIONS as readonly string[]).includes(name),
    );
    if (unknown.length > 0) {
      this.logger.warn("Ignoring stored permissions that are not in the catalog", {
        userId,
        unknown,
      });
    }

    return { userId, status: access.status, permissions };
  }
}
