import type { CreateTicketBody } from "@docket/contracts";

import type { TicketEntity, TicketRepository } from "../../src/modules/tickets/ticket.types.js";

export class InMemoryTicketRepository implements TicketRepository {
  readonly tickets: TicketEntity[] = [];
  private nextId = 1;

  async create(data: CreateTicketBody): Promise<TicketEntity> {
    const now = new Date();
    const ticket: TicketEntity = {
      id: this.nextId++,
      title: data.title,
      description: data.description ?? null,
      status: "open",
      priority: data.priority,
      createdAt: now,
      updatedAt: now,
    };

    this.tickets.push(ticket);
    return ticket;
  }
}
