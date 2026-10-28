import type { Permission } from "@docket/contracts";

import type { Container } from "../../src/container.js";
import { seedUser, type UserSeed } from "./seed-users.js";

/**
 * Seeds a user and returns headers that authenticate as them, with the permissions their roles
 * grant. A bearer token skips the login round trip and the CSRF check that applies to cookies.
 */
export async function signIn(
  container: Container,
  {
    email = "agent@example.com",
    roles = ["member"],
    status = "active",
    ...rest
  }: Partial<UserSeed> = {},
) {
  const user = await seedUser(container, { email, roles, status, ...rest });
  const grants = await container.database.client.rolePermission.findMany({
    where: { role: { name: { in: roles } } },
    select: { permission: true },
  });
  const permissions =
    status === "active"
      ? [...new Set(grants.map(({ permission }) => permission as Permission))]
      : [];

  const { token } = await container.identity.tokenIssuer.issueAccessToken({
    userId: user.id,
    status,
    permissions,
  });
  return { user, headers: { Authorization: `Bearer ${token}` } };
}
