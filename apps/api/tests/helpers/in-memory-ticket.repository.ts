import type { CreateTicketBody, ListTicketsQuery, UpdateTicketBody } from "@docket/contracts";

import type {
  StatusCounts,
  TicketEntity,
  TicketPage,
  TicketRepository,
  TicketUpdateFilter,
} from "../../src/modules/tickets/ticket.types.js";

export class InMemoryTicketRepository implements TicketRepository {
  readonly tickets: TicketEntity[] = [];
  readonly creators = new Map<number, string>();
  private nextId = 1;

  async create(data: CreateTicketBody, createdById: string): Promise<TicketEntity> {
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
    this.creators.set(ticket.id, createdById);
    return ticket;
  }

  async list({ status, page, limit }: ListTicketsQuery): Promise<TicketPage> {
    const matching = this.tickets
      .filter((ticket) => !status || ticket.status === status)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id - a.id);

    const start = (page - 1) * limit;
    return { items: matching.slice(start, start + limit), total: matching.length };
  }

  async update(
    id: number,
    data: UpdateTicketBody,
    { createdById }: TicketUpdateFilter = {},
  ): Promise<TicketEntity | null> {
    const ticket = this.tickets.find((candidate) => candidate.id === id);
    if (!ticket) return null;
    if (createdById && this.creators.get(id) !== createdById) return null;

    Object.assign(ticket, {
      ...(data.status && { status: data.status }),
      ...(data.priority && { priority: data.priority }),
      updatedAt: new Date(),
    });
    return ticket;
  }

  async exists(id: number): Promise<boolean> {
    return this.tickets.some((ticket) => ticket.id === id);
  }

  async countByStatus(): Promise<StatusCounts> {
    const counts: StatusCounts = {};
    for (const { status } of this.tickets) {
      counts[status] = (counts[status] ?? 0) + 1;
    }
    return counts;
  }
}
