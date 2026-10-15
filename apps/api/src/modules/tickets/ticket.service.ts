import type { CreateTicketBody } from "@docket/contracts";

import type { Monitor } from "../../core/monitoring/monitor.interface.js";
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
}
