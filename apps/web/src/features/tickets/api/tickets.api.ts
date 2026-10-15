import { ticketSchema, type CreateTicketInput, type Ticket } from "@docket/contracts";

import { request } from "@/shared/api/http-client";

export async function createTicket(input: CreateTicketInput): Promise<Ticket> {
  const data = await request<unknown>("/tickets", { method: "POST", body: input });
  return ticketSchema.parse(data);
}
