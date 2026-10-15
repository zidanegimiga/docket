import type { CreateTicketBody, ListTicketsQuery } from "@docket/contracts";

import { Prisma, type PrismaClient } from "../../generated/prisma/client.js";
import type { TicketEntity, TicketPage, TicketRepository } from "./ticket.types.js";

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

  async list({ status, page, limit }: ListTicketsQuery): Promise<TicketPage> {
    const where: Prisma.TicketWhereInput = status ? { status } : {};

    const [items, total] = await this.db.$transaction(
      [
        this.db.ticket.findMany({
          where,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          skip: (page - 1) * limit,
          take: limit,
        }),
        this.db.ticket.count({ where }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );

    return { items, total };
  }
}
