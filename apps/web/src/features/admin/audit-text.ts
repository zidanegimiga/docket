import type { AuditAction, AuditEvent } from "@docket/contracts";

import { userStatusLabels } from "./labels";

export const auditActionLabels: Record<AuditAction, string> = {
  "user.status_changed": "User status",
  "user.roles_changed": "User roles",
  "user.permissions_changed": "Extra permissions",
  "user.promoted": "Promoted from the command line",
  "role.created": "Role created",
  "role.updated": "Role changed",
  "role.deleted": "Role deleted",
};

const list = (items: readonly string[]) => items.join(", ");

function setChange(added: readonly string[], removed: readonly string[]): string {
  return [
    added.length > 0 && `added ${list(added)}`,
    removed.length > 0 && `removed ${list(removed)}`,
  ]
    .filter(Boolean)
    .join("; ");
}

/** One plain sentence per entry, written from the administrator's point of view. */
export function describeAuditEvent(event: AuditEvent): string {
  const target = event.target.label;

  switch (event.action) {
    case "user.status_changed": {
      const { from, to } = event.changes;
      if (from === "pending" && to === "active") return `Approved ${target}`;
      if (to === "disabled") return `Disabled ${target}`;
      if (from === "disabled" && to === "active") return `Re-enabled ${target}`;
      return `Changed ${target} from ${userStatusLabels[from].toLowerCase()} to ${userStatusLabels[to].toLowerCase()}`;
    }
    case "user.roles_changed":
      return `Roles of ${target}: ${setChange(event.changes.added, event.changes.removed)}`;
    case "user.permissions_changed":
      return `Extra permissions of ${target}: ${setChange(event.changes.added, event.changes.removed)}`;
    case "user.promoted":
      return `Made ${target} an administrator`;
    case "role.created": {
      const count = event.changes.permissions.length;
      return `Created role ${target} with ${count} ${count === 1 ? "permission" : "permissions"}`;
    }
    case "role.updated": {
      const { name, description, permissions } = event.changes;
      const parts = [
        name && `renamed from ${name.from}`,
        description && "changed the description",
        permissions && `permissions ${setChange(permissions.added, permissions.removed)}`,
      ].filter(Boolean);
      return `Changed role ${target}: ${parts.join("; ")}`;
    }
    case "role.deleted":
      return `Deleted role ${target}`;
  }
}
