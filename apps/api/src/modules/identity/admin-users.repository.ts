import type { ListUsersQuery, UpdateUserBody } from "@docket/contracts";

import { Prisma, type PrismaClient } from "../../generated/prisma/client.js";
import { ADMIN_ROLE } from "./admin-promotion.js";
import type {
  AccessChangeSnapshot,
  AdminRole,
  AdminUserRecord,
  AdminUserRepository,
} from "./admin-users.types.js";

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

  async updateAccess(
    id: string,
    change: UpdateUserBody,
    check: (snapshot: AccessChangeSnapshot) => void,
  ): Promise<AdminUserRecord | null> {
    // Inside the transaction every query is flat and awaited in turn: Prisma would otherwise load
    // sibling relations concurrently on the transaction's single connection, which pg deprecates.
    const found = await this.db.$transaction(async (tx) => {
      // Every access change takes this lock first, so two administrators demoting each other at
      // the same moment are judged one after the other and the last-admin rule holds.
      await tx.$queryRaw`SELECT "id" FROM "roles" WHERE "name" = ${ADMIN_ROLE} FOR UPDATE`;

      const user = await tx.user.findUnique({ where: { id }, select: { id: true, status: true } });
      if (!user) return false;

      const currentRoles = await rolesWhere(tx, { users: { some: { userId: id } } });
      const currentGrants = await tx.userPermission.findMany({
        where: { userId: id },
        select: { permission: true },
      });
      const requestedRoles = change.roleIds
        ? await rolesWhere(tx, { id: { in: change.roleIds } })
        : currentRoles;
      const otherActiveAdmins = await tx.user.count({
        where: {
          id: { not: id },
          status: "active",
          roles: { some: { role: { name: ADMIN_ROLE } } },
        },
      });

      const before = {
        ...user,
        roles: currentRoles,
        directPermissions: currentGrants.map(({ permission }) => permission),
      };
      check({
        before,
        after: {
          status: change.status ?? user.status,
          roles: requestedRoles,
          directPermissions: change.directPermissions ?? before.directPermissions,
        },
        unknownRoleIds: (change.roleIds ?? []).filter(
          (roleId) => !requestedRoles.some((role) => role.id === roleId),
        ),
        otherActiveAdmins,
      });

      if (change.status && change.status !== user.status) {
        await tx.user.update({
          where: { id },
          data: { status: change.status },
          select: { id: true },
        });
        if (change.status === "disabled") {
          await tx.refreshToken.updateMany({
            where: { userId: id, revokedAt: null },
            data: { revokedAt: new Date() },
          });
        }
      }
      if (change.roleIds) {
        await tx.userRole.deleteMany({ where: { userId: id } });
        await tx.userRole.createMany({
          data: change.roleIds.map((roleId) => ({ userId: id, roleId })),
        });
      }
      if (change.directPermissions) {
        await tx.userPermission.deleteMany({ where: { userId: id } });
        await tx.userPermission.createMany({
          data: change.directPermissions.map((permission) => ({ userId: id, permission })),
        });
      }
      return true;
    });

    if (!found) return null;
    return toRecord(
      await this.db.user.findUniqueOrThrow({ where: { id }, select: adminUserColumns }),
    );
  }
}

/** Roles with their permissions, read with two flat queries. */
async function rolesWhere(
  tx: Prisma.TransactionClient,
  where: Prisma.RoleWhereInput,
): Promise<AdminRole[]> {
  const roles = await tx.role.findMany({
    where,
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const grants = await tx.rolePermission.findMany({
    where: { roleId: { in: roles.map((role) => role.id) } },
    select: { roleId: true, permission: true },
  });
  return roles.map((role) => ({
    ...role,
    permissions: grants
      .filter((grant) => grant.roleId === role.id)
      .map((grant) => grant.permission),
  }));
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
