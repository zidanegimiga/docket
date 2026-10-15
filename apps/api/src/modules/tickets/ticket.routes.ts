import { createTicketSchema, listTicketsQuerySchema } from "@docket/contracts";
import { Router } from "express";

import { validate } from "../../shared/middleware/validate.middleware.js";
import type { TicketController } from "./ticket.controller.js";

export function ticketRoutes(controller: TicketController): Router {
  const router = Router();

  router.get("/", validate({ query: listTicketsQuerySchema }), controller.list);
  router.post("/", validate({ body: createTicketSchema }), controller.create);

  return router;
}
