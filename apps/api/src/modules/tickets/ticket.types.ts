import type {
  CreateTicketBody,
  ListTicketsQuery,
  TicketPriority,
  TicketStatus,
  UpdateTicketBody,
} from "@docket/contracts";

export interface TicketEntity {
  id: number;
  title: string;
  description: string | null;
  status: TicketStatus;
  priority: TicketPriority;
  createdAt: Date;
  updatedAt: Date;
}

export interface TicketPage {
  items: TicketEntity[];
  total: number;
}

export type StatusCounts = Partial<Record<TicketStatus, number>>;

export interface TicketRepository {
  create(data: CreateTicketBody): Promise<TicketEntity>;
  list(query: ListTicketsQuery): Promise<TicketPage>;
  update(id: number, data: UpdateTicketBody): Promise<TicketEntity | null>;
  countByStatus(): Promise<StatusCounts>;
}
