import { z } from "zod";

export const TICKET_STATUSES = ["open", "in_progress", "closed"] as const;
export const TICKET_PRIORITIES = ["low", "medium", "high"] as const;

export const TITLE_MAX_LENGTH = 200;
export const DESCRIPTION_MAX_LENGTH = 5000;

export const ticketStatusSchema = z.enum(TICKET_STATUSES);
export const ticketPrioritySchema = z.enum(TICKET_PRIORITIES);

export type TicketStatus = z.infer<typeof ticketStatusSchema>;
export type TicketPriority = z.infer<typeof ticketPrioritySchema>;

export const ticketSchema = z.object({
  id: z.number().int().positive(),
  title: z.string(),
  description: z.string().nullable(),
  status: ticketStatusSchema,
  priority: ticketPrioritySchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type Ticket = z.infer<typeof ticketSchema>;

export const createTicketSchema = z.strictObject({
  title: z.string().trim().min(1, "Title is required").max(TITLE_MAX_LENGTH),
  description: z
    .string()
    .trim()
    .max(DESCRIPTION_MAX_LENGTH)
    .optional()
    .transform((value) => value || undefined),
  priority: ticketPrioritySchema.default("medium"),
});

export type CreateTicketInput = z.input<typeof createTicketSchema>;
export type CreateTicketBody = z.output<typeof createTicketSchema>;
