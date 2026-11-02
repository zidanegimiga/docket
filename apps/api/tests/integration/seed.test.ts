import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { SEED_PASSWORD, SEED_TICKETS } from "../../scripts/seed/seed-data.js";
import { seedDatabase } from "../../scripts/seed/seed-database.js";
import type { Container } from "../../src/container.js";
import { createTestContainer, resetDatabase, TEST_WEB_ORIGIN } from "../helpers/test-app.js";

describe("seedDatabase", () => {
  let container: Container;

  beforeAll(async () => {
    container = await createTestContainer();
    await container.database.connect();
  });

  afterAll(async () => {
    await container.database.disconnect();
  });

  beforeEach(async () => {
    await resetDatabase(container);
  });

  const seed = () => seedDatabase(container.database.client, container.identity.passwordHasher);

  it("adds the accounts and tickets once, however often it runs", async () => {
    await expect(seed()).resolves.toEqual({
      accountsCreated: 3,
      ticketsCreated: SEED_TICKETS.length,
    });
    await expect(seed()).resolves.toEqual({ accountsCreated: 0, ticketsCreated: 0 });

    await expect(container.database.client.ticket.count()).resolves.toBe(SEED_TICKETS.length);
  });

  it("never changes an existing account", async () => {
    await seed();
    const db = container.database.client;
    await db.user.update({ where: { email: "member@docket.test" }, data: { name: "Renamed" } });

    await seed();

    await expect(
      db.user.findUniqueOrThrow({ where: { email: "member@docket.test" } }),
    ).resolves.toMatchObject({ name: "Renamed" });
  });

  it("creates accounts people can sign in with, each with the access its role gives", async () => {
    await seed();
    const signIn = (email: string) =>
      request
        .agent(container.app)
        .set("Origin", TEST_WEB_ORIGIN)
        .post("/auth/login")
        .send({ email, password: SEED_PASSWORD });

    const [admin, member, pending] = await Promise.all([
      signIn("admin@docket.test"),
      signIn("member@docket.test"),
      signIn("pending@docket.test"),
    ]);

    expect(admin.body.user.permissions).toContain("users:manage");
    expect(member.body.user.permissions).toEqual([
      "tickets:read",
      "tickets:create",
      "tickets:update:own",
    ]);
    expect(pending.body.user).toMatchObject({ status: "pending", permissions: [] });
  });

  it("gives tickets creators and dates that look like real use", async () => {
    await seed();
    const tickets = await container.database.client.ticket.findMany({ orderBy: { id: "asc" } });

    expect(tickets.every((ticket) => ticket.createdById !== null)).toBe(true);
    expect(tickets.every((ticket) => ticket.updatedAt >= ticket.createdAt)).toBe(true);
    // Older tickets get lower ids.
    const created = tickets.map((ticket) => ticket.createdAt.getTime());
    expect(created).toEqual([...created].sort((a, b) => a - b));
  });
});
