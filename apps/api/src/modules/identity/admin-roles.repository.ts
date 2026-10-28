import type { CreateRoleBody, UpdateRoleBody } from "@docket/contracts";

import { Prisma, type PrismaClient } from "../../generated/prisma/client.js";
import type {
  AdminRoleRecord,
  AdminRoleRepository,
  DeleteRoleOutcome,
} from "./admin-roles.types.js";

const UNIQUE_VIOLATION = "P2002";

const roleListColumns = {
  id: true,
  name: true,
  description: true,
  isSystem: true,
  permissions: { select: { permission: true }, orderBy: { permission: "asc" } },
  _count: { select: { users: true } },
} satisfies Prisma.RoleSelect;

type RoleRow = Prisma.RoleGetPayload<{ select: typeof roleListColumns }>;

const toRecord = ({ permissions, _count, ...role }: RoleRow): AdminRoleRecord => ({
  ...role,
  permissions: permissions.map(({ permission }) => permission),
  userCount: _count.users,
});

const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === UNIQUE_VIOLATION;

export class PrismaAdminRoleRepository implements AdminRoleRepository {
  constructor(private readonly db: PrismaClient) {}

  async list(): Promise<AdminRoleRecord[]> {
    const roles = await this.db.role.findMany({
      select: roleListColumns,
      // System roles first, so admin and member lead every picker.
      orderBy: [{ isSystem: "desc" }, { name: "asc" }],
    });
    return roles.map(toRecord);
  }

  async findById(id: string): Promise<AdminRoleRecord | null> {
    const role = await this.db.role.findUnique({ where: { id }, select: roleListColumns });
    return role && toRecord(role);
  }

  async create({
    name,
    description,
    permissions,
  }: CreateRoleBody): Promise<AdminRoleRecord | null> {
    try {
      const role = await this.db.role.create({
        data: {
          name,
          description: description ?? null,
          permissions: { create: permissions.map((permission) => ({ permission })) },
        },
        select: roleListColumns,
      });
      return toRecord(role);
    } catch (error) {
      if (isUniqueViolation(error)) return null;
      throw error;
    }
  }

  async update(
    id: string,
    { name, description, permissions }: UpdateRoleBody,
  ): Promise<AdminRoleRecord | null> {
    try {
      const role = await this.db.role.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(description !== undefined && { description }),
          ...(permissions && {
            permissions: {
              deleteMany: {},
              create: permissions.map((permission) => ({ permission })),
            },
          }),
        },
        select: roleListColumns,
      });
      return toRecord(role);
    } catch (error) {
      if (isUniqueViolation(error)) return null;
      throw error;
    }
  }

  async delete(id: string): Promise<DeleteRoleOutcome> {
    const { count } = await this.db.role.deleteMany({
      where: { id, isSystem: false, users: { none: {} } },
    });
    if (count === 1) return "deleted";
    const exists = await this.db.role.count({ where: { id } });
    return exists ? "refused" : "not_found";
  }
}
