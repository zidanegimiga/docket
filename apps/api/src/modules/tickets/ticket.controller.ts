import type { CreateTicketBody } from "@docket/contracts";
import type { RequestHandler } from "express";

import type { TicketService } from "./ticket.service.js";

type Params = Record<string, string>;

export class TicketController {
  constructor(private readonly service: TicketService) {}

  create: RequestHandler<Params, unknown, CreateTicketBody> = async (req, res) => {
    const ticket = await this.service.create(req.body);
    res.status(201).json(ticket);
  };
}
