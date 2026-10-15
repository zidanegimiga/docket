import type { Router } from "express";

import type { DatabaseProvider } from "../../core/database/database.interface.js";
import type { Monitor } from "../../core/monitoring/monitor.interface.js";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { TicketController } from "./ticket.controller.js";
import { PrismaTicketRepository } from "./ticket.repository.js";
import { ticketRoutes } from "./ticket.routes.js";
import { TicketService } from "./ticket.service.js";

export interface TicketModuleDeps {
  database: DatabaseProvider<PrismaClient>;
  monitor: Monitor;
}

export function createTicketModule({ database, monitor }: TicketModuleDeps): Router {
  const repository = new PrismaTicketRepository(database.client);
  const service = new TicketService(repository, monitor);
  const controller = new TicketController(service);

  return ticketRoutes(controller);
}
