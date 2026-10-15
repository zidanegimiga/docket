import type { CreateTicketBody, TicketPriority, TicketStatus } from "@docket/contracts";

export interface TicketEntity {
  id: number;
  title: string;
  description: string | null;
  status: TicketStatus;
  priority: TicketPriority;
  createdAt: Date;
  updatedAt: Date;
}

export interface TicketRepository {
  create(data: CreateTicketBody): Promise<TicketEntity>;
}
