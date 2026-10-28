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
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TicketPage {
  items: TicketEntity[];
  total: number;
}

export type StatusCounts = Partial<Record<TicketStatus, number>>;

export interface TicketUpdateFilter {
  /** Only update the ticket if this user created it. */
  createdById?: string;
}

export interface TicketRepository {
  create(data: CreateTicketBody, createdById: string): Promise<TicketEntity>;
  list(query: ListTicketsQuery): Promise<TicketPage>;
  /** Null when no ticket matches the id and the filter. */
  update(
    id: number,
    data: UpdateTicketBody,
    filter?: TicketUpdateFilter,
  ): Promise<TicketEntity | null>;
  exists(id: number): Promise<boolean>;
  countByStatus(): Promise<StatusCounts>;
}
