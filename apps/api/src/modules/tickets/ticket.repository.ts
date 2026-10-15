import type { CreateTicketBody } from "@docket/contracts";

import type { PrismaClient } from "../../generated/prisma/client.js";
import type { TicketEntity, TicketRepository } from "./ticket.types.js";

export class PrismaTicketRepository implements TicketRepository {
  constructor(private readonly db: PrismaClient) {}

  create(data: CreateTicketBody): Promise<TicketEntity> {
    return this.db.ticket.create({
      data: {
        title: data.title,
        description: data.description ?? null,
        priority: data.priority,
      },
    });
  }
}
