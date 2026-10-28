import type { UserStatus } from "@docket/contracts";

import type { Container } from "../../src/container.js";

export interface UserSeed {
  email: string;
  name?: string;
  password?: string;
  status?: UserStatus;
  roles?: string[];
}

export async function seedUser(
  { database, identity }: Container,
  { email, name = "Test User", password, status = "active", roles = [] }: UserSeed,
) {
  const user = await database.client.user.create({
    data: {
      email,
      name,
      status,
      passwordHash: password ? await identity.passwordHasher.hash(password) : null,
      roles: { create: roles.map((role) => ({ role: { connect: { name: role } } })) },
    },
  });
  return user;
}
