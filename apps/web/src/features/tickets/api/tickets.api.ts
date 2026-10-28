import {
  ticketListSchema,
  ticketSchema,
  ticketStatsSchema,
  type CreateTicketInput,
  type ListTicketsQuery,
  type Ticket,
  type TicketList,
  type TicketStats,
  type UpdateTicketBody,
} from "@docket/contracts";

import { request, type RequestContext } from "@/shared/api/http-client";

export async function listTickets(
  { status, page, limit }: ListTicketsQuery,
  signal?: AbortSignal,
  context: RequestContext = {},
): Promise<TicketList> {
  const data = await request<unknown>("/tickets", {
    ...context,
    query: { status, page, limit },
    ...(signal && { signal }),
  });
  return ticketListSchema.parse(data);
}

export async function createTicket(input: CreateTicketInput): Promise<Ticket> {
  const data = await request<unknown>("/tickets", { method: "POST", body: input });
  return ticketSchema.parse(data);
}

export async function updateTicket(id: number, data: UpdateTicketBody): Promise<Ticket> {
  const result = await request<unknown>(`/tickets/${id}`, { method: "PATCH", body: data });
  return ticketSchema.parse(result);
}

export async function getTicketStats(
  signal?: AbortSignal,
  context: RequestContext = {},
): Promise<TicketStats> {
  const data = await request<unknown>("/tickets/stats", { ...context, ...(signal && { signal }) });
  return ticketStatsSchema.parse(data);
}
