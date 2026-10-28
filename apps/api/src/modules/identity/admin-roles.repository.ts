import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";

const roleListColumns = {
  id: true,
  name: true,
  description: true,
  isSystem: true,
  permissions: { select: { permission: true } },
  _count: { select: { users: true } },
} satisfies Prisma.RoleSelect;

export interface AdminRoleRecord {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: string[];
  userCount: number;
}

export interface AdminRoleRepository {
  list(): Promise<AdminRoleRecord[]>;
}

export class PrismaAdminRoleRepository implements AdminRoleRepository {
  constructor(private readonly db: PrismaClient) {}

  async list(): Promise<AdminRoleRecord[]> {
    const roles = await this.db.role.findMany({
      select: roleListColumns,
      // System roles first, so admin and member lead every picker.
      orderBy: [{ isSystem: "desc" }, { name: "asc" }],
    });
    return roles.map(({ permissions, _count, ...role }) => ({
      ...role,
      permissions: permissions.map(({ permission }) => permission),
      userCount: _count.users,
    }));
  }
}
