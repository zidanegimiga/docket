import { TICKET_STATUSES, ticketStatsSchema } from "@docket/contracts";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Container } from "../../src/container.js";
import { seedTickets } from "../helpers/seed-tickets.js";
import { createTestContainer, resetDatabase } from "../helpers/test-app.js";

describe("GET /tickets/stats", () => {
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

  const getStats = async () => {
    const response = await request(container.app).get("/tickets/stats");
    return { status: response.status, stats: ticketStatsSchema.parse(response.body) };
  };

  it("reports every status at zero when there are no tickets", async () => {
    const { status, stats } = await getStats();

    expect(status).toBe(200);
    expect(stats).toEqual({ total: 0, byStatus: { open: 0, in_progress: 0, closed: 0 } });
  });

  it("counts tickets per status and includes statuses with none", async () => {
    await seedTickets(container, [
      { status: "open" },
      { status: "open" },
      { status: "open" },
      { status: "closed" },
    ]);

    const { stats } = await getStats();

    expect(stats).toEqual({ total: 4, byStatus: { open: 3, in_progress: 0, closed: 1 } });
  });

  it("keeps the total equal to the sum of the status counts", async () => {
    await seedTickets(container, [
      { status: "open" },
      { status: "in_progress" },
      { status: "in_progress" },
      { status: "closed" },
      { status: "closed" },
    ]);

    const { stats } = await getStats();
    const sum = TICKET_STATUSES.reduce((total, status) => total + stats.byStatus[status], 0);

    expect(stats.total).toBe(5);
    expect(sum).toBe(stats.total);
  });

  it("reflects a status change made through the API", async () => {
    await seedTickets(container, [{ status: "open" }]);

    await request(container.app).patch("/tickets/1").send({ status: "in_progress" });
    const { stats } = await getStats();

    expect(stats.byStatus).toEqual({ open: 0, in_progress: 1, closed: 0 });
  });
});
