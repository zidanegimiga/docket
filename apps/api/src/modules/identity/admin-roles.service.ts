import {
  PERMISSIONS,
  type CreateRoleBody,
  type Permission,
  type UpdateRoleBody,
} from "@docket/contracts";

import type { Monitor } from "../../core/monitoring/monitor.interface.js";
import { ConflictError } from "../../shared/errors/conflict.error.js";
import { NotFoundError } from "../../shared/errors/not-found.error.js";
import { assertRoleDeletable, assertRoleUpdateAllowed } from "./admin-roles.policy.js";
import type { AdminRoleEntity, AdminRoleRecord, AdminRoleRepository } from "./admin-roles.types.js";

const isCatalogPermission = (name: string): name is Permission =>
  (PERMISSIONS as readonly string[]).includes(name);

const toEntity = (role: AdminRoleRecord): AdminRoleEntity => ({
  ...role,
  permissions: role.permissions.filter(isCatalogPermission),
});

const nameTaken = (name: string) =>
  new ConflictError("ROLE_NAME_TAKEN", `A role called "${name}" already exists`);

/** Role changes reach the people who hold them at their next token refresh. */
export class AdminRoleService {
  constructor(
    private readonly roles: AdminRoleRepository,
    private readonly monitor: Monitor,
  ) {}

  async list(): Promise<AdminRoleEntity[]> {
    return (await this.roles.list()).map(toEntity);
  }

  async create(role: CreateRoleBody): Promise<AdminRoleEntity> {
    const created = await this.roles.create(role);
    if (!created) throw nameTaken(role.name);
    this.monitor.recordMetric("admin.role_changes", 1, { action: "create" });
    return toEntity(created);
  }

  async update(id: string, change: UpdateRoleBody): Promise<AdminRoleEntity> {
    const role = await this.roles.findById(id);
    if (!role) throw new NotFoundError("Role", id);
    assertRoleUpdateAllowed(role, change);

    const updated = await this.roles.update(id, change);
    if (!updated) throw nameTaken(change.name ?? role.name);
    this.monitor.recordMetric("admin.role_changes", 1, { action: "update" });
    return toEntity(updated);
  }

  async delete(id: string): Promise<void> {
    const role = await this.roles.findById(id);
    if (!role) throw new NotFoundError("Role", id);
    assertRoleDeletable(role);

    const outcome = await this.roles.delete(id);
    if (outcome === "not_found") throw new NotFoundError("Role", id);
    if (outcome === "refused") {
      // Someone was given the role between the check and the delete.
      const current = await this.roles.findById(id);
      if (current) assertRoleDeletable(current);
      throw new ConflictError("ROLE_IN_USE", "This role was just assigned. Try again.");
    }
    this.monitor.recordMetric("admin.role_changes", 1, { action: "delete" });
  }
}
