import type { ListAuditQuery } from "@docket/contracts";
import type { RequestHandler } from "express";

import type { AuditLogService } from "./audit.service.js";

type Params = Record<string, string>;

export class AuditLogController {
  constructor(private readonly service: AuditLogService) {}

  list: RequestHandler<Params, unknown, unknown, ListAuditQuery> = async (req, res) => {
    res.set("Cache-Control", "no-store");
    res.json(await this.service.list(req.query));
  };
}
