import type { AuditChange, AuditEvent, ListAuditQuery } from "@docket/contracts";

/** Who made a change and in which request, attached to every audit entry. */
export interface AuditContext {
  /** Null for changes made from the command line. */
  actorId: string | null;
  requestId: string | null;
}

export type NewAuditEvent = AuditChange &
  AuditContext & {
    targetType: "user" | "role";
    targetId: string;
    /** The target's email or name at the time. */
    targetLabel: string;
  };

export type AuditEventEntity = Omit<AuditEvent, "occurredAt"> & { occurredAt: Date };

export interface AuditLogRepository {
  list(query: ListAuditQuery): Promise<{ items: AuditEventEntity[]; total: number }>;
}

/** Added and removed between two lists, both in a stable order; null when nothing changed. */
export function diffSets<Item>(before: readonly Item[], after: readonly Item[]) {
  const added = after.filter((item) => !before.includes(item));
  const removed = before.filter((item) => !after.includes(item));
  return added.length > 0 || removed.length > 0 ? { added, removed } : null;
}
