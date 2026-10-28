import type { CreateRoleBody, UpdateRoleBody } from "@docket/contracts";
import type { RequestHandler } from "express";

import type { RoleIdParams } from "./admin-roles.schemas.js";
import type { AdminRoleService } from "./admin-roles.service.js";

type Params = Record<string, string>;

export class AdminRoleController {
  constructor(private readonly service: AdminRoleService) {}

  list: RequestHandler = async (_req, res) => {
    res.set("Cache-Control", "no-store");
    res.json({ data: await this.service.list() });
  };

  create: RequestHandler<Params, unknown, CreateRoleBody> = async (req, res) => {
    res.status(201).json(await this.service.create(req.body));
  };

  update: RequestHandler<RoleIdParams, unknown, UpdateRoleBody> = async (req, res) => {
    res.json(await this.service.update(req.params.id, req.body));
  };

  delete: RequestHandler<RoleIdParams> = async (req, res) => {
    await this.service.delete(req.params.id);
    res.status(204).end();
  };
}
