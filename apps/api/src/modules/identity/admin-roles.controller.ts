import { PERMISSIONS, type Permission } from "@docket/contracts";
import type { RequestHandler } from "express";

import type { AdminRoleRepository } from "./admin-roles.repository.js";

const isCatalogPermission = (name: string): name is Permission =>
  (PERMISSIONS as readonly string[]).includes(name);

export class AdminRoleController {
  constructor(private readonly roles: AdminRoleRepository) {}

  list: RequestHandler = async (_req, res) => {
    const roles = await this.roles.list();
    res.set("Cache-Control", "no-store");
    res.json({
      data: roles.map((role) => ({
        ...role,
        permissions: role.permissions.filter(isCatalogPermission),
      })),
    });
  };
}
