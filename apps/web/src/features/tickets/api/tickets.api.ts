import {
  ticketListSchema,
  ticketSchema,
  type CreateTicketInput,
  type ListTicketsQuery,
  type Ticket,
  type TicketList,
} from "@docket/contracts";

import { request } from "@/shared/api/http-client";

export async function listTickets(
  { status, page, limit }: ListTicketsQuery,
  signal?: AbortSignal,
): Promise<TicketList> {
  const data = await request<unknown>("/tickets", {
    query: { status, page, limit },
    ...(signal && { signal }),
  });
  return ticketListSchema.parse(data);
}

export async function createTicket(input: CreateTicketInput): Promise<Ticket> {
  const data = await request<unknown>("/tickets", { method: "POST", body: input });
  return ticketSchema.parse(data);
}
