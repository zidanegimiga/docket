import { ticketSchema } from "@docket/contracts";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Container } from "../../src/container.js";
import { seedTickets } from "../helpers/seed-tickets.js";
import { signIn } from "../helpers/sign-in.js";
import { createTestContainer, resetDatabase } from "../helpers/test-app.js";

describe("PATCH /tickets/:id", () => {
  let container: Container;
  let auth: Record<string, string>;

  beforeAll(async () => {
    container = await createTestContainer();
    await container.database.connect();
  });

  afterAll(async () => {
    await container.database.disconnect();
  });

  beforeEach(async () => {
    await resetDatabase(container);
    ({ headers: auth } = await signIn(container, { roles: ["admin"] }));
    await seedTickets(container, [{ title: "VPN drops", status: "open", priority: "medium" }]);
  });

  const patch = (id: string | number, body: unknown) =>
    request(container.app)
      .patch(`/tickets/${id}`)
      .set(auth)
      .send(body as object);

  const storedTicket = () =>
    container.database.client.ticket.findUniqueOrThrow({ where: { id: 1 } });

  it("updates the status only and moves updatedAt forward", async () => {
    const before = await storedTicket();

    const response = await patch(1, { status: "in_progress" });

    expect(response.status).toBe(200);
    const ticket = ticketSchema.parse(response.body);
    expect(ticket).toMatchObject({ id: 1, status: "in_progress", priority: "medium" });
    expect(new Date(ticket.createdAt)).toEqual(before.createdAt);
    expect(new Date(ticket.updatedAt).getTime()).toBeGreaterThan(before.updatedAt.getTime());
  });

  it("updates the priority only", async () => {
    const response = await patch(1, { priority: "high" });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: "open", priority: "high" });
    await expect(storedTicket()).resolves.toMatchObject({ status: "open", priority: "high" });
  });

  it("allows reopening a closed ticket", async () => {
    await patch(1, { status: "closed" });

    const response = await patch(1, { status: "open" });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("open");
  });

  it("returns 404 for a ticket that does not exist", async () => {
    const response = await patch(999, { status: "closed" });

    expect(response.status).toBe(404);
    expect(response.body.error).toMatchObject({
      code: "NOT_FOUND",
      message: "Ticket 999 was not found",
    });
  });

  it.each([
    { label: "an empty body", body: {}, path: "body" },
    { label: "a field that cannot be patched", body: { title: "Renamed" }, path: "body" },
    { label: "an unknown status", body: { status: "done" }, path: "body.status" },
    { label: "an unknown priority", body: { priority: "urgent" }, path: "body.priority" },
  ])("rejects $label and leaves the ticket unchanged", async ({ body, path }) => {
    const response = await patch(1, body);

    expect(response.status).toBe(400);
    expect(response.body.error.details[0].path).toBe(path);
    await expect(storedTicket()).resolves.toMatchObject({
      title: "VPN drops",
      status: "open",
      priority: "medium",
    });
  });

  it.each(["abc", "1e3", "0", "99999999999"])("rejects the id %s with a 400", async (id) => {
    const response = await patch(id, { status: "closed" });

    expect(response.status).toBe(400);
    expect(response.body.error.details[0].path).toBe("params.id");
  });
});
