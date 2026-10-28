import {
  PERMISSIONS,
  type ListUsersQuery,
  type Permission,
  type UpdateUserBody,
} from "@docket/contracts";

import type { EmailSender } from "../../core/email/email-sender.interface.js";
import type { Principal } from "../../core/identity/principal.js";
import type { Monitor } from "../../core/monitoring/monitor.interface.js";
import { NotFoundError } from "../../shared/errors/not-found.error.js";

import { paginate, type Paginated } from "../../shared/http/pagination.js";
import { effectivePermissions } from "./access.service.js";
import { assertAccessChangeAllowed } from "./admin-users.policy.js";
import type { AdminUserEntity, AdminUserRecord, AdminUserRepository } from "./admin-users.types.js";

const isCatalogPermission = (name: string): name is Permission =>
  (PERMISSIONS as readonly string[]).includes(name);

export interface AdminUserServiceDeps {
  users: AdminUserRepository;
  emailSender: EmailSender;
  monitor: Monitor;
}

export class AdminUserService {
  constructor(private readonly deps: AdminUserServiceDeps) {}

  async list(query: ListUsersQuery): Promise<Paginated<AdminUserEntity>> {
    const { items, total } = await this.deps.users.list(query);
    return paginate(items.map(toEntity), total, query);
  }

  /**
   * Approves, disables or re-enables a user and replaces their roles or direct grants. Changes
   * reach the user's session at its next refresh; disabling ends their sessions at once.
   */
  async update(id: string, change: UpdateUserBody, actor: Principal): Promise<AdminUserEntity> {
    let previousStatus: AdminUserRecord["status"] | undefined;
    const updated = await this.deps.users.updateAccess(id, change, (snapshot) => {
      assertAccessChangeAllowed(actor, snapshot);
      previousStatus = snapshot.before.status;
    });
    if (!updated) throw new NotFoundError("User", id);

    if (previousStatus !== updated.status) {
      this.deps.monitor.recordMetric("admin.user_status_changes", 1, { status: updated.status });
    }
    if (previousStatus === "pending" && updated.status === "active") {
      await this.notifyApproved(updated);
    }
    return toEntity(updated);
  }

  private async notifyApproved({ email, name }: AdminUserRecord): Promise<void> {
    try {
      await this.deps.emailSender.send({
        to: email,
        subject: "Your Docket account is ready",
        text: `Hi ${name},\n\nAn administrator approved your account. You can now sign in and start using Docket.`,
      });
    } catch (error) {
      // The approval stands even if the email does not go out.
      this.deps.monitor.captureException(error, { context: "admin.approval_email" });
    }
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
