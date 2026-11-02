import type { ListAuditQuery } from "@docket/contracts";

import { paginate, type Paginated } from "../../shared/http/pagination.js";
import type { AuditEventEntity, AuditLogRepository } from "./audit.types.js";

export class AuditLogService {
  constructor(private readonly events: AuditLogRepository) {}

  async list(query: ListAuditQuery): Promise<Paginated<AuditEventEntity>> {
    const { items, total } = await this.events.list(query);
    return paginate(items, total, query);
  }
}
