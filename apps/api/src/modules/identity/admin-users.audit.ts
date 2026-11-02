import type { Permission } from "@docket/contracts";

import type { AccessChangeSnapshot } from "./admin-users.types.js";
import { diffSets, type AuditContext, type NewAuditEvent } from "./audit.types.js";

/** One audit entry per kind of change, and none for a save that changed nothing. */
export function describeAccessChange(
  { before, after }: AccessChangeSnapshot,
  context: AuditContext,
): NewAuditEvent[] {
  const target = { targetType: "user" as const, targetId: before.id, targetLabel: before.email };
  const events: NewAuditEvent[] = [];

  if (after.status !== before.status) {
    events.push({
      ...context,
      ...target,
      action: "user.status_changed",
      changes: { from: before.status, to: after.status },
    });
  }

  const roles = diffSets(
    before.roles.map((role) => role.name),
    after.roles.map((role) => role.name),
  );
  if (roles) events.push({ ...context, ...target, action: "user.roles_changed", changes: roles });

  const permissions = diffSets(
    before.directPermissions as Permission[],
    after.directPermissions as Permission[],
  );
  if (permissions) {
    events.push({
      ...context,
      ...target,
      action: "user.permissions_changed",
      changes: permissions,
    });
  }

  return events;
}
