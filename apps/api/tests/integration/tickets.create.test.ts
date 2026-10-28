import { ticketSchema } from "@docket/contracts";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Container } from "../../src/container.js";
import { createTestContainer, resetDatabase } from "../helpers/test-app.js";

describe("POST /tickets", () => {
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

  const post = (body: unknown) =>
    request(container.app)
      .post("/tickets")
      .send(body as object);

  it("creates a ticket with defaults and returns it", async () => {
    const response = await post({ title: "Printer jammed" });

    expect(response.status).toBe(201);
    expect(ticketSchema.parse(response.body)).toMatchObject({
      id: 1,
      title: "Printer jammed",
      description: null,
      status: "open",
      priority: "medium",
    });
    await expect(container.database.client.ticket.count()).resolves.toBe(1);
  });

  it("returns exactly the fields in the contract", async () => {
    const response = await post({ title: "Printer jammed" });

    expect(Object.keys(response.body).sort()).toEqual(Object.keys(ticketSchema.shape).sort());
  });

  it("trims the title and drops a blank description", async () => {
    const response = await post({ title: "  VPN drops  ", description: "   ", priority: "high" });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      title: "VPN drops",
      description: null,
      priority: "high",
    });
  });

  it("rejects invalid input with every issue and persists nothing", async () => {
    const response = await post({ title: "", priority: "urgent", status: "closed" });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_FAILED");
    expect(response.body.error.requestId).toEqual(expect.any(String));
    expect(response.body.error.details).toEqual([
      { path: "body.title", message: "Title is required" },
      { path: "body.priority", message: expect.any(String) },
      { path: "body", message: expect.stringContaining("status") },
    ]);
    await expect(container.database.client.ticket.count()).resolves.toBe(0);
  });

  it("rejects a title longer than 200 characters", async () => {
    const response = await post({ title: "x".repeat(201) });

    expect(response.status).toBe(400);
    expect(response.body.error.details[0].path).toBe("body.title");
  });

  it("rejects a malformed JSON body", async () => {
    const response = await request(container.app)
      .post("/tickets")
      .set("content-type", "application/json")
      .send('{"title":');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("MALFORMED_JSON");
  });
});
