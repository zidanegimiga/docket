import type { UserStatus } from "@docket/contracts";

import type { PrismaClient } from "../../generated/prisma/client.js";

export const ADMIN_ROLE = "admin";

export type AdminPromotion =
  | { promoted: true; userId: string; previousStatus: UserStatus; alreadyAdmin: boolean }
  | { promoted: false; reason: "user_not_found" };

/**
 * Makes an existing account an active administrator. This is how the first administrator is
 * created: from the command line by someone with database access, never through the API, so
 * nobody can claim the role by being the first to sign up.
 */
export function promoteToAdmin(db: PrismaClient, email: string): Promise<AdminPromotion> {
  return db.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { email }, select: { id: true, status: true } });
    if (!user) return { promoted: false, reason: "user_not_found" };

    const role = await tx.role.findUniqueOrThrow({
      where: { name: ADMIN_ROLE },
      select: { id: true },
    });
    const existing = await tx.userRole.findUnique({
      where: { userId_roleId: { userId: user.id, roleId: role.id } },
      select: { userId: true },
    });

    if (!existing) {
      await tx.userRole.create({ data: { userId: user.id, roleId: role.id } });
    }
    if (user.status !== "active") {
      await tx.user.update({
        where: { id: user.id },
        data: { status: "active" },
        select: { id: true },
      });
    }

    return {
      promoted: true,
      userId: user.id,
      previousStatus: user.status,
      alreadyAdmin: existing !== null,
    };
  });
}
