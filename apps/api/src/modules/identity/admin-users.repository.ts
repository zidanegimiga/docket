import type { ListUsersQuery } from "@docket/contracts";

import { Prisma, type PrismaClient } from "../../generated/prisma/client.js";
import type { AdminUserRecord, AdminUserRepository } from "./admin-users.types.js";

const adminUserColumns = {
  id: true,
  email: true,
  name: true,
  status: true,
  passwordHash: true,
  createdAt: true,
  lastLoginAt: true,
  roles: {
    select: {
      role: { select: { id: true, name: true, permissions: { select: { permission: true } } } },
    },
    orderBy: { role: { name: "asc" } },
  },
  permissions: { select: { permission: true } },
  identities: { select: { provider: true }, orderBy: { provider: "asc" } },
} satisfies Prisma.UserSelect;

// Prisma's contains becomes LIKE without escaping, so a search for "%" would match everyone.
const escapeLike = (value: string) => value.replace(/[\\%_]/g, (character) => `\\${character}`);

type AdminUserRow = Prisma.UserGetPayload<{ select: typeof adminUserColumns }>;

export class PrismaAdminUserRepository implements AdminUserRepository {
  constructor(private readonly db: PrismaClient) {}

  async list({ status, search, page, limit }: ListUsersQuery) {
    const pattern = search && escapeLike(search);
    const where: Prisma.UserWhereInput = {
      ...(status && { status }),
      ...(pattern && {
        OR: [
          { email: { contains: pattern, mode: "insensitive" } },
          { name: { contains: pattern, mode: "insensitive" } },
        ],
      }),
    };

    // Relations load in one query each for the whole page, not one per user. The two queries run
    // in parallel rather than in a transaction: Prisma would send the relation queries concurrently
    // on the transaction's single connection, which pg deprecates, and a total that is a moment
    // out of date is harmless here.
    const [rows, total] = await Promise.all([
      this.db.user.findMany({
        where,
        select: adminUserColumns,
        // The status enum is declared pending, active, disabled, so pending users come first.
        orderBy: [{ status: "asc" }, { createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.db.user.count({ where }),
    ]);

    return { items: rows.map(toRecord), total };
  }
}

function toRecord({
  passwordHash,
  roles,
  permissions,
  identities,
  ...user
}: AdminUserRow): AdminUserRecord {
  return {
    ...user,
    hasPassword: passwordHash !== null,
    roles: roles.map(({ role }) => ({
      id: role.id,
      name: role.name,
      permissions: role.permissions.map(({ permission }) => permission),
    })),
    directPermissions: permissions.map(({ permission }) => permission),
    providers: identities.map(({ provider }) => provider),
  };
}
