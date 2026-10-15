import type { Pagination, Ticket, TicketList } from "@docket/contracts";

export function makeTicket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: 1,
    title: "Printer jammed on floor 2",
    description: null,
    status: "open",
    priority: "medium",
    createdAt: "2026-10-15T07:42:00.000Z",
    updatedAt: "2026-10-15T07:42:00.000Z",
    ...overrides,
  };
}

export function makeTicketList(
  tickets: Ticket[],
  pagination: Partial<Pagination> = {},
): TicketList {
  return {
    data: tickets,
    pagination: {
      page: 1,
      limit: 20,
      total: tickets.length,
      totalPages: tickets.length > 0 ? 1 : 0,
      ...pagination,
    },
  };
}
