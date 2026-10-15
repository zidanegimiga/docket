import type { CreateTicketBody, ListTicketsQuery } from "@docket/contracts";

import type { Monitor } from "../../core/monitoring/monitor.interface.js";
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
}
