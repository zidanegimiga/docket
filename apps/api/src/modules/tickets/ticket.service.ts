import type { CreateTicketBody, ListTicketsQuery, UpdateTicketBody } from "@docket/contracts";

import type { Monitor } from "../../core/monitoring/monitor.interface.js";
import { NotFoundError } from "../../shared/errors/not-found.error.js";
import { paginate, type Paginated } from "../../shared/http/pagination.js";
import type { TicketEntity, TicketRepository } from "./ticket.types.js";

export class TicketService {
  constructor(
    private readonly repository: TicketRepository,
    private readonly monitor: Monitor,
  ) {}

  async create(data: CreateTicketBody): Promise<TicketEntity> {
    const ticket = await this.repository.create(data);
    this.monitor.recordMetric("tickets.created", 1, { priority: ticket.priority });
    return ticket;
  }

  async list(query: ListTicketsQuery): Promise<Paginated<TicketEntity>> {
    const { items, total } = await this.repository.list(query);
    return paginate(items, total, query);
  }

  async update(id: number, data: UpdateTicketBody): Promise<TicketEntity> {
    const ticket = await this.repository.update(id, data);
    if (!ticket) {
      throw new NotFoundError("Ticket", id);
    }

    if (data.status) {
      this.monitor.recordMetric("tickets.status_updated", 1, { status: ticket.status });
    }
    return ticket;
  }
}
