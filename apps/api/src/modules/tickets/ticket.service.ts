import {
  TICKET_STATUSES,
  type CreateTicketBody,
  type ListTicketsQuery,
  type TicketStats,
  type TicketStatus,
  type UpdateTicketBody,
} from "@docket/contracts";

import type { Principal } from "../../core/identity/principal.js";
import type { Monitor } from "../../core/monitoring/monitor.interface.js";
import { ForbiddenError } from "../../shared/errors/forbidden.error.js";
import { NotFoundError } from "../../shared/errors/not-found.error.js";
import { paginate, type Paginated } from "../../shared/http/pagination.js";
import { ticketUpdateScope } from "./ticket.policy.js";
import type { TicketEntity, TicketRepository } from "./ticket.types.js";

export class TicketService {
  constructor(
    private readonly repository: TicketRepository,
    private readonly monitor: Monitor,
  ) {}

  async create(data: CreateTicketBody, actor: Principal): Promise<TicketEntity> {
    const ticket = await this.repository.create(data, actor.userId);
    this.monitor.recordMetric("tickets.created", 1, { priority: ticket.priority });
    return ticket;
  }

  async list(query: ListTicketsQuery): Promise<Paginated<TicketEntity>> {
    const { items, total } = await this.repository.list(query);
    return paginate(items, total, query);
  }

  async update(id: number, data: UpdateTicketBody, actor: Principal): Promise<TicketEntity> {
    const scope = ticketUpdateScope(actor);
    if (!scope) {
      throw new ForbiddenError("PERMISSION_DENIED", "You do not have permission to update tickets");
    }

    const createdById = scope.kind === "own" ? scope.creatorId : undefined;
    const ticket = await this.repository.update(id, data, { createdById });
    if (!ticket) {
      // Everyone who can update can also read every ticket, so saying it exists leaks nothing.
      if (createdById && (await this.repository.exists(id))) {
        throw new ForbiddenError("NOT_TICKET_OWNER", "You can only update tickets you created");
      }
      throw new NotFoundError("Ticket", id);
    }

    if (data.status) {
      this.monitor.recordMetric("tickets.status_updated", 1, { status: ticket.status });
    }
    return ticket;
  }

  async stats(): Promise<TicketStats> {
    const counts = await this.repository.countByStatus();

    const byStatus = Object.fromEntries(
      TICKET_STATUSES.map((status) => [status, counts[status] ?? 0]),
    ) as Record<TicketStatus, number>;
    const total = TICKET_STATUSES.reduce((sum, status) => sum + byStatus[status], 0);

    return { total, byStatus };
  }
}
