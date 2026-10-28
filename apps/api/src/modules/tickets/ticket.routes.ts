import { createTicketSchema, listTicketsQuerySchema, updateTicketSchema } from "@docket/contracts";
import { type RequestHandler, Router } from "express";

import {
  requireAnyPermission,
  requirePermission,
} from "../../shared/middleware/authorize.middleware.js";
import { validate } from "../../shared/middleware/validate.middleware.js";
import type { TicketController } from "./ticket.controller.js";
import { ticketIdParamsSchema } from "./ticket.schemas.js";

export function ticketRoutes(controller: TicketController, authenticate: RequestHandler): Router {
  const router = Router();

  // Every ticket route needs a signed-in caller; each then names the permission it needs.
  router.use(authenticate);

  router.get(
    "/",
    requirePermission("tickets:read"),
    validate({ query: listTicketsQuerySchema }),
    controller.list,
  );
  router.get("/stats", requirePermission("tickets:read"), controller.stats);
  router.post(
    "/",
    requirePermission("tickets:create"),
    validate({ body: createTicketSchema }),
    controller.create,
  );
  router.patch(
    "/:id",
    requireAnyPermission("tickets:update:own", "tickets:update:any"),
    validate({ params: ticketIdParamsSchema, body: updateTicketSchema }),
    controller.update,
  );

  return router;
}
