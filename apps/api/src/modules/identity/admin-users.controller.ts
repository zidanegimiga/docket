import type { ListUsersQuery } from "@docket/contracts";
import type { RequestHandler } from "express";

import type { AdminUserService } from "./admin-users.service.js";

type Params = Record<string, string>;

export class AdminUserController {
  constructor(private readonly service: AdminUserService) {}

  list: RequestHandler<Params, unknown, unknown, ListUsersQuery> = async (req, res) => {
    res.set("Cache-Control", "no-store");
    res.json(await this.service.list(req.query));
  };
}
