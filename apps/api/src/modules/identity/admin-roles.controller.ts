import type { CreateRoleBody, UpdateRoleBody } from "@docket/contracts";
import type { Request, RequestHandler } from "express";

import { principalOf } from "../../shared/middleware/authenticate.middleware.js";

import type { RoleIdParams } from "./admin-roles.schemas.js";
import type { AdminRoleService } from "./admin-roles.service.js";
import type { AuditContext } from "./audit.types.js";

type Params = Record<string, string>;

const auditContext = (req: Request): AuditContext => ({
  actorId: principalOf(req).userId,
  requestId: req.id,
});

export class AdminRoleController {
  constructor(private readonly service: AdminRoleService) {}

  list: RequestHandler = async (_req, res) => {
    res.set("Cache-Control", "no-store");
    res.json({ data: await this.service.list() });
  };

  create: RequestHandler<Params, unknown, CreateRoleBody> = async (req, res) => {
    res.status(201).json(await this.service.create(req.body, auditContext(req)));
  };

  update: RequestHandler<RoleIdParams, unknown, UpdateRoleBody> = async (req, res) => {
    res.json(await this.service.update(req.params.id, req.body, auditContext(req)));
  };

  delete: RequestHandler<RoleIdParams> = async (req, res) => {
    await this.service.delete(req.params.id, auditContext(req));
    res.status(204).end();
  };
}
