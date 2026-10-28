import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Container } from "../../src/container.js";
import { seedTickets } from "../helpers/seed-tickets.js";
import { seedUser } from "../helpers/seed-users.js";
import { signIn } from "../helpers/sign-in.js";
import { createTestContainer, resetDatabase, TEST_WEB_ORIGIN } from "../helpers/test-app.js";

const routes = [
  { method: "get", path: "/tickets" },
  { method: "get", path: "/tickets/stats" },
  { method: "post", path: "/tickets", body: { title: "Printer jammed" } },
  { method: "patch", path: "/tickets/1", body: { status: "closed" } },
] as const;

describe("ticket authorization", () => {
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
    await seedTickets(container, [{ title: "Legacy ticket without a creator" }]);
  });

  const send = (route: (typeof routes)[number], headers: Record<string, string> = {}) => {
    const pending = request(container.app)[route.method](route.path).set(headers);
    return "body" in route ? pending.send(route.body) : pending;
  };

  it.each(routes)("requires sign-in for $method $path", async (route) => {
    const response = await send(route);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("AUTHENTICATION_REQUIRED");
  });

  it.each(routes)("tells a pending user to wait for approval on $method $path", async (route) => {
    const { headers } = await signIn(container, { status: "pending" });

    const response = await send(route, headers);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("ACCOUNT_PENDING");
  });

  it.each(routes)("denies $method $path to an active user without permissions", async (route) => {
    const { headers } = await signIn(container, { roles: [] });

    const response = await send(route, headers);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("PERMISSION_DENIED");
  });

  it("records the creator of a new ticket", async () => {
    const { user, headers } = await signIn(container);

    const response = await request(container.app)
      .post("/tickets")
      .set(headers)
      .send({ title: "Monitor flickers" });

    const stored = await container.database.client.ticket.findUniqueOrThrow({
      where: { id: response.body.id },
    });
    expect(stored.createdById).toBe(user.id);
    expect(response.body).not.toHaveProperty("createdById");
  });

  describe("updates", () => {
    const createAs = async (headers: Record<string, string>) =>
      (await request(container.app).post("/tickets").set(headers).send({ title: "Mine" })).body
        .id as number;

    const update = (id: number, headers: Record<string, string>) =>
      request(container.app).patch(`/tickets/${id}`).set(headers).send({ status: "closed" });

    it("lets a member update a ticket they created", async () => {
      const { headers } = await signIn(container);
      const id = await createAs(headers);

      await expect(update(id, headers)).resolves.toMatchObject({ status: 200 });
    });

    it("stops a member from updating a colleague's ticket, leaving it unchanged", async () => {
      const { headers: author } = await signIn(container);
      const { headers: colleague } = await signIn(container, { email: "colleague@example.com" });
      const id = await createAs(author);

      const response = await update(id, colleague);

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("NOT_TICKET_OWNER");
      await expect(
        container.database.client.ticket.findUniqueOrThrow({ where: { id } }),
      ).resolves.toMatchObject({ status: "open" });
    });

    it("stops a member from updating a ticket nobody owns", async () => {
      const { headers } = await signIn(container);

      await expect(update(1, headers)).resolves.toMatchObject({ status: 403 });
    });

    it("lets an admin update anyone's ticket", async () => {
      const { headers: author } = await signIn(container);
      const { headers: admin } = await signIn(container, {
        email: "admin@example.com",
        roles: ["admin"],
      });
      const id = await createAs(author);

      await expect(update(id, admin)).resolves.toMatchObject({ status: 200 });
      await expect(update(1, admin)).resolves.toMatchObject({ status: 200 });
    });
  });

  it("works with the browser session from a real login", async () => {
    await seedUser(container, {
      email: "jane@example.com",
      password: "correct horse battery",
      roles: ["member"],
    });
    const agent = request.agent(container.app).set("Origin", TEST_WEB_ORIGIN);
    await agent
      .post("/auth/login")
      .send({ email: "jane@example.com", password: "correct horse battery" });

    const list = await agent.get("/tickets");
    const created = await agent.post("/tickets").send({ title: "From the browser" });

    expect(list.status).toBe(200);
    expect(created.status).toBe(201);
  });
});
