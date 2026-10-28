import type { CreateTicketBody, ListTicketsQuery, UpdateTicketBody } from "@docket/contracts";
import type { RequestHandler } from "express";

import { principalOf } from "../../shared/middleware/authenticate.middleware.js";
import type { TicketIdParams } from "./ticket.schemas.js";
import type { TicketService } from "./ticket.service.js";

type Params = Record<string, string>;

export class TicketController {
  constructor(private readonly service: TicketService) {}

  list: RequestHandler<Params, unknown, unknown, ListTicketsQuery> = async (req, res) => {
    const page = await this.service.list(req.query);
    res.json(page);
  };

  stats: RequestHandler = async (_req, res) => {
    const stats = await this.service.stats();
    res.json(stats);
  };

  create: RequestHandler<Params, unknown, CreateTicketBody> = async (req, res) => {
    const ticket = await this.service.create(req.body, principalOf(req));
    res.status(201).json(ticket);
  };

  update: RequestHandler<TicketIdParams, unknown, UpdateTicketBody> = async (req, res) => {
    const ticket = await this.service.update(req.params.id, req.body, principalOf(req));
    res.json(ticket);
  };
}
