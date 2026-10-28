import { PERMISSIONS, type ListUsersQuery, type Permission } from "@docket/contracts";

import { paginate, type Paginated } from "../../shared/http/pagination.js";
import { effectivePermissions } from "./access.service.js";
import type { AdminUserEntity, AdminUserRecord, AdminUserRepository } from "./admin-users.types.js";

const isCatalogPermission = (name: string): name is Permission =>
  (PERMISSIONS as readonly string[]).includes(name);

export class AdminUserService {
  constructor(private readonly users: AdminUserRepository) {}

  async list(query: ListUsersQuery): Promise<Paginated<AdminUserEntity>> {
    const { items, total } = await this.users.list(query);
    return paginate(items.map(toEntity), total, query);
  }
}

function toEntity({ roles, directPermissions, ...user }: AdminUserRecord): AdminUserEntity {
  const { permissions } = effectivePermissions({
    status: user.status,
    rolePermissions: roles.flatMap((role) => role.permissions),
    directPermissions,
  });

  return {
    ...user,
    roles: roles.map(({ id, name }) => ({ id, name })),
    directPermissions: directPermissions.filter(isCatalogPermission),
    effectivePermissions: permissions,
  };
}
