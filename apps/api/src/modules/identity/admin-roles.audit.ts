import { PERMISSIONS, type Permission, type UpdateRoleBody } from "@docket/contracts";

import type { AdminRoleRecord } from "./admin-roles.types.js";
import { diffSets, type AuditContext, type NewAuditEvent } from "./audit.types.js";

const catalogOnly = (permissions: readonly string[]): Permission[] =>
  PERMISSIONS.filter((permission) => permissions.includes(permission));

const target = (role: Pick<AdminRoleRecord, "id" | "name">) => ({
  targetType: "role" as const,
  targetId: role.id,
  targetLabel: role.name,
});

export function describeRoleCreated(role: AdminRoleRecord, context: AuditContext): NewAuditEvent {
  return {
    ...context,
    ...target(role),
    action: "role.created",
    changes: { permissions: catalogOnly(role.permissions) },
  };
}

/** Null when the change would leave the role as it was. */
export function describeRoleUpdated(
  before: AdminRoleRecord,
  change: UpdateRoleBody,
  context: AuditContext,
): NewAuditEvent | null {
  const name =
    change.name !== undefined && change.name !== before.name
      ? { from: before.name, to: change.name }
      : undefined;
  const description =
    change.description !== undefined && change.description !== before.description
      ? { from: before.description, to: change.description }
      : undefined;
  const permissions = change.permissions
    ? (diffSets(catalogOnly(before.permissions), change.permissions) ?? undefined)
    : undefined;

  if (!name && !description && !permissions) return null;
  return {
    ...context,
    // Labelled with the new name, so the log reads as it will be seen from now on.
    ...target({ id: before.id, name: name?.to ?? before.name }),
    action: "role.updated",
    changes: {
      ...(name && { name }),
      ...(description && { description }),
      ...(permissions && { permissions }),
    },
  };
}

export function describeRoleDeleted(role: AdminRoleRecord, context: AuditContext): NewAuditEvent {
  return {
    ...context,
    ...target(role),
    action: "role.deleted",
    changes: { permissions: catalogOnly(role.permissions) },
  };
}
