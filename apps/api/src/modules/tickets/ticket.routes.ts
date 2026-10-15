import { createTicketSchema, listTicketsQuerySchema, updateTicketSchema } from "@docket/contracts";
import { Router } from "express";

import { validate } from "../../shared/middleware/validate.middleware.js";
import type { TicketController } from "./ticket.controller.js";
import { ticketIdParamsSchema } from "./ticket.schemas.js";

export function ticketRoutes(controller: TicketController): Router {
  const router = Router();

  router.get("/", validate({ query: listTicketsQuerySchema }), controller.list);
  router.post("/", validate({ body: createTicketSchema }), controller.create);
  router.patch(
    "/:id",
    validate({ params: ticketIdParamsSchema, body: updateTicketSchema }),
    controller.update,
  );

  return router;
}
