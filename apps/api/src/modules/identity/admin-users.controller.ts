import type { ListUsersQuery, UpdateUserBody } from "@docket/contracts";
import type { RequestHandler } from "express";

import { principalOf } from "../../shared/middleware/authenticate.middleware.js";
import type { UserIdParams } from "./admin-users.schemas.js";
import type { AdminUserService } from "./admin-users.service.js";

type Params = Record<string, string>;

export class AdminUserController {
  constructor(private readonly service: AdminUserService) {}

  list: RequestHandler<Params, unknown, unknown, ListUsersQuery> = async (req, res) => {
    res.set("Cache-Control", "no-store");
    res.json(await this.service.list(req.query));
  };

  update: RequestHandler<UserIdParams, unknown, UpdateUserBody> = async (req, res) => {
    const user = await this.service.update(req.params.id, req.body, principalOf(req));
    res.set("Cache-Control", "no-store");
    res.json(user);
  };
}
