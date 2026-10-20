import type { CreateTicketBody, ListTicketsQuery, UpdateTicketBody } from "@docket/contracts";

import { Prisma, type PrismaClient } from "../../generated/prisma/client.js";
import type { StatusCounts, TicketEntity, TicketPage, TicketRepository } from "./ticket.types.js";

const RECORD_NOT_FOUND = "P2025";

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

  async update(id: number, data: UpdateTicketBody): Promise<TicketEntity | null> {
    try {
      return await this.db.ticket.update({
        where: { id },
        data: {
          ...(data.status && { status: data.status }),
          ...(data.priority && { priority: data.priority }),
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === RECORD_NOT_FOUND
      ) {
        return null;
      }
      throw error;
    }
  }

  async countByStatus(): Promise<StatusCounts> {
    const groups = await this.db.ticket.groupBy({
      by: ["status"],
      _count: { _all: true },
    });

    return Object.fromEntries(groups.map((group) => [group.status, group._count._all]));
  }
}
