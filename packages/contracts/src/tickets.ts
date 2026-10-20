import { z } from "zod";

import { pageQuerySchema, paginatedSchema } from "./pagination.js";

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
    .transform((value) => value || undefined)
    .optional(),
  priority: ticketPrioritySchema.default("medium"),
});

export type CreateTicketInput = z.input<typeof createTicketSchema>;
export type CreateTicketBody = z.output<typeof createTicketSchema>;

export const updateTicketSchema = z
  .strictObject({
    status: ticketStatusSchema.optional(),
    priority: ticketPrioritySchema.optional(),
  })
  .refine((data) => data.status !== undefined || data.priority !== undefined, {
    message: "Provide a status or a priority to update",
  });

export type UpdateTicketBody = z.infer<typeof updateTicketSchema>;

export const listTicketsQuerySchema = pageQuerySchema.extend({
  status: ticketStatusSchema.optional(),
});

export type ListTicketsInput = z.input<typeof listTicketsQuerySchema>;
export type ListTicketsQuery = z.output<typeof listTicketsQuerySchema>;

export const ticketListSchema = paginatedSchema(ticketSchema);

export type TicketList = z.infer<typeof ticketListSchema>;

export const ticketStatsSchema = z.object({
  total: z.number().int().min(0),
  byStatus: z.record(ticketStatusSchema, z.number().int().min(0)),
});

export type TicketStats = z.infer<typeof ticketStatsSchema>;
