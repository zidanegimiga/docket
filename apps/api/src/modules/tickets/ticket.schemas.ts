import { z } from "zod";

const MAX_TICKET_ID = 2_147_483_647;

export const ticketIdParamsSchema = z.object({
  id: z
    .string()
    .regex(/^\d+$/, "Ticket id must be a positive whole number")
    .transform(Number)
    .pipe(z.number().int().min(1).max(MAX_TICKET_ID)),
});

export type TicketIdParams = z.output<typeof ticketIdParamsSchema>;
