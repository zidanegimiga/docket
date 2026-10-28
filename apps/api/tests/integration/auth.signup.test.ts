import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Container } from "../../src/container.js";
import { RecordingEmailSender } from "../helpers/recording.email-sender.js";
import { createTestContainer, resetDatabase } from "../helpers/test-app.js";

describe("POST /auth/signup", () => {
  let container: Container;
  const email = new RecordingEmailSender();

  beforeAll(async () => {
    container = await createTestContainer({ emailSender: email });
    await container.database.connect();
  });

  afterAll(async () => {
    await container.database.disconnect();
  });

  beforeEach(async () => {
    await resetDatabase(container);
    email.sent.length = 0;
  });

  const signUp = (body: object) => request(container.app).post("/auth/signup").send(body);
  const jane = { email: "Jane@Example.com", name: "Jane Doe", password: "correct horse battery" };

  it("accepts the sign-up and stores a pending user with an Argon2id hash", async () => {
    const response = await signUp(jane);

    expect(response.status).toBe(202);
    expect(response.body).toEqual({ message: expect.stringContaining("administrator's approval") });

    const stored = await container.database.client.user.findUniqueOrThrow({
      where: { email: "jane@example.com" },
    });
    expect(stored).toMatchObject({ name: "Jane Doe", status: "pending" });
    expect(stored.passwordHash).toMatch(/^\$argon2id\$/);
    expect(stored.passwordHash).not.toContain(jane.password);
    expect(email.sent.map((message) => message.subject)).toEqual([
      "Your Docket account is waiting for approval",
    ]);
  });

  it("answers an already registered email exactly like a new one", async () => {
    const first = await signUp(jane);
    const second = await signUp({
      ...jane,
      email: "jane@example.com",
      password: "a different password",
    });

    expect(second.status).toBe(first.status);
    expect(second.body).toEqual(first.body);
    await expect(container.database.client.user.count()).resolves.toBe(1);
    expect(email.sent.map((message) => message.subject)).toEqual([
      "Your Docket account is waiting for approval",
      "Someone tried to sign up with your email",
    ]);
  });

  it("rejects weak or malformed input with field errors and stores nothing", async () => {
    const response = await signUp({ email: "not-an-email", name: " ", password: "short" });

    expect(response.status).toBe(400);
    expect(response.body.error.details.map((issue: { path: string }) => issue.path)).toEqual([
      "body.email",
      "body.name",
      "body.password",
    ]);
    await expect(container.database.client.user.count()).resolves.toBe(0);
  });

  it("refuses a sign-up that tries to choose its own status or role", async () => {
    const response = await signUp({ ...jane, status: "active", role: "admin" });

    expect(response.status).toBe(400);
    await expect(container.database.client.user.count()).resolves.toBe(0);
  });
});
