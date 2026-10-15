import type { CreateTicketBody, ListTicketsQuery } from "@docket/contracts";

import type {
  TicketEntity,
  TicketPage,
  TicketRepository,
} from "../../src/modules/tickets/ticket.types.js";

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

  async list({ status, page, limit }: ListTicketsQuery): Promise<TicketPage> {
    const matching = this.tickets
      .filter((ticket) => !status || ticket.status === status)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id - a.id);

    const start = (page - 1) * limit;
    return { items: matching.slice(start, start + limit), total: matching.length };
  }
}
