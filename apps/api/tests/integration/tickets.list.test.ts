import { ticketListSchema } from "@docket/contracts";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Container } from "../../src/container.js";
import { seedTickets } from "../helpers/seed-tickets.js";
import { createTestContainer, resetDatabase } from "../helpers/test-app.js";

describe("GET /tickets", () => {
  let container: Container;

  beforeAll(async () => {
    container = createTestContainer();
    await container.database.connect();
  });

  afterAll(async () => {
    await container.database.disconnect();
  });

  beforeEach(async () => {
    await resetDatabase(container);
  });

  const list = async (query = "") => {
    const response = await request(container.app).get(`/tickets${query}`);
    return { status: response.status, body: response.body };
  };

  const ids = (body: unknown) => ticketListSchema.parse(body).data.map((ticket) => ticket.id);

  it("returns tickets newest first with default pagination", async () => {
    await seedTickets(container, [{}, {}, {}]);

    const { status, body } = await list();

    expect(status).toBe(200);
    expect(ids(body)).toEqual([3, 2, 1]);
    expect(body.pagination).toEqual({ page: 1, limit: 20, total: 3, totalPages: 1 });
  });

  it("breaks ties on creation time by id, newest id first", async () => {
    const sameMoment = new Date("2026-02-01T12:00:00.000Z");
    await seedTickets(container, [{ createdAt: sameMoment }, { createdAt: sameMoment }]);

    const { body } = await list();

    expect(ids(body)).toEqual([2, 1]);
  });

  it("filters by status and counts only matching tickets", async () => {
    await seedTickets(container, [
      { status: "open" },
      { status: "closed" },
      { status: "in_progress" },
      { status: "closed" },
    ]);

    const { body } = await list("?status=closed");

    expect(ids(body)).toEqual([4, 2]);
    expect(body.pagination.total).toBe(2);
  });

  it("returns a partial last page", async () => {
    await seedTickets(container, [{}, {}, {}, {}, {}]);

    const { body } = await list("?page=3&limit=2");

    expect(ids(body)).toEqual([1]);
    expect(body.pagination).toEqual({ page: 3, limit: 2, total: 5, totalPages: 3 });
  });

  it("returns an empty page past the end instead of an error", async () => {
    await seedTickets(container, [{}, {}]);

    const { status, body } = await list("?page=4&limit=2");

    expect(status).toBe(200);
    expect(ids(body)).toEqual([]);
    expect(body.pagination.totalPages).toBe(1);
  });

  it("defaults to 20 per page and rejects a limit above 100", async () => {
    await seedTickets(
      container,
      Array.from({ length: 25 }, () => ({})),
    );

    const defaulted = await list();
    const tooLarge = await list("?limit=101");

    expect(defaulted.body.data).toHaveLength(20);
    expect(defaulted.body.pagination.totalPages).toBe(2);
    expect(tooLarge.status).toBe(400);
  });

  it("rejects invalid query values with every issue", async () => {
    const { status, body } = await list("?status=done&page=0");

    expect(status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_FAILED");
    expect(body.error.details.map((issue: { path: string }) => issue.path)).toEqual([
      "query.page",
      "query.status",
    ]);
  });
});
