import { auditChangeSchema, type ListAuditQuery } from "@docket/contracts";

import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import type { AuditEventEntity, AuditLogRepository, NewAuditEvent } from "./audit.types.js";

/**
 * Inserts audit entries with the transaction client of the change they describe, so a change and
 * its record commit or roll back together.
 */
export async function recordAuditEvents(
  tx: Prisma.TransactionClient,
  events: readonly NewAuditEvent[],
): Promise<void> {
  if (events.length === 0) return;
  await tx.auditEvent.createMany({
    data: events.map(
      ({ action, changes, actorId, requestId, targetType, targetId, targetLabel }) => ({
        action,
        changes,
        actorId,
        requestId,
        targetType,
        targetId,
        targetLabel,
      }),
    ),
  });
}

export class PrismaAuditLogRepository implements AuditLogRepository {
  constructor(private readonly db: PrismaClient) {}

  async list({ action, targetId, page, limit }: ListAuditQuery) {
    const where: Prisma.AuditEventWhereInput = {
      ...(action && { action }),
      ...(targetId && { targetId }),
    };
    const [rows, total] = await Promise.all([
      this.db.auditEvent.findMany({
        where,
        orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.db.auditEvent.count({ where }),
    ]);

    // Actors are looked up once for the whole page, not per entry.
    const actorIds = [...new Set(rows.flatMap((row) => (row.actorId ? [row.actorId] : [])))];
    const actors = await this.db.user.findMany({
      where: { id: { in: actorIds } },
      select: { id: true, email: true },
    });
    const emailOf = new Map(actors.map((actor) => [actor.id, actor.email]));

    const items = rows.map((row): AuditEventEntity => ({
      id: row.id,
      occurredAt: row.occurredAt,
      actor: row.actorId
        ? { id: row.actorId, label: emailOf.get(row.actorId) ?? "A deleted user" }
        : null,
      target: {
        type: row.targetType as "user" | "role",
        id: row.targetId,
        label: row.targetLabel,
      },
      requestId: row.requestId,
      // Parsed so an entry the code cannot describe fails loudly instead of rendering wrongly.
      ...auditChangeSchema.parse({ action: row.action, changes: row.changes }),
    }));
    return { items, total };
  }
}
