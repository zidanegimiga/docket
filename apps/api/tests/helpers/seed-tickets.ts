import type { TicketPriority, TicketStatus } from "@docket/contracts";

import type { Container } from "../../src/container.js";

export interface TicketSeed {
  title?: string;
  status?: TicketStatus;
  priority?: TicketPriority;
  createdAt?: Date;
}

const BASE_TIME = Date.parse("2026-01-01T09:00:00.000Z");

export async function seedTickets({ database }: Container, seeds: TicketSeed[]): Promise<void> {
  await database.client.ticket.createMany({
    data: seeds.map((seed, index) => {
      const createdAt = seed.createdAt ?? new Date(BASE_TIME + index * 60_000);
      return {
        title: seed.title ?? `Ticket ${index + 1}`,
        status: seed.status ?? "open",
        priority: seed.priority ?? "medium",
        createdAt,
        updatedAt: createdAt,
      };
    }),
  });
}
