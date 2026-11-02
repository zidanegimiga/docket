import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { Container } from "../../src/container.js";
import { RecordingEmailSender } from "../helpers/recording.email-sender.js";
import { seedUser } from "../helpers/seed-users.js";
import { createTestContainer, resetDatabase } from "../helpers/test-app.js";

const password = "correct horse battery";

describe("rate limits on sign-in and sign-up", () => {
  let container: Container;
  const email = new RecordingEmailSender();

  // A fresh app per test gives fresh in-memory counters.
  beforeEach(async () => {
    container = await createTestContainer({ emailSender: email }, { RATE_LIMIT_ENABLED: "true" });
    await container.database.connect();
    await resetDatabase(container);
    email.sent.length = 0;
  });

  afterEach(async () => {
    await container.database.disconnect();
  });

  const logIn = (body: object, ip = "203.0.113.10") =>
    request(container.app).post("/auth/login").set("X-Forwarded-For", ip).send(body);

  const failTimes = async (count: number, address: string, ip?: string) => {
    for (let i = 0; i < count; i++) {
      await logIn({ email: address, password: "wrong password" }, ip);
    }
  };

  it("blocks an account after ten failed attempts, even with the right password", async () => {
    await seedUser(container, { email: "jane@example.com", password, roles: ["member"] });
    await failTimes(10, "jane@example.com");

    const response = await logIn({ email: "jane@example.com", password });

    expect(response.status).toBe(429);
    expect(response.body.error).toMatchObject({
      code: "RATE_LIMITED",
      message: expect.stringMatching(
        /^Too many failed sign-in attempts for this account\. Try again in \d+ minutes?\.$/,
      ),
    });
    expect(response.headers["ratelimit-policy"]).toContain("login-account");
    expect(response.headers["retry-after"]).toMatch(/^\d+$/);
  });

  it("counts attempts on unknown emails the same way, so limits reveal nothing", async () => {
    await failTimes(10, "nobody@example.com");

    const response = await logIn({ email: "nobody@example.com", password });

    expect(response.status).toBe(429);
  });

  it("limits each account separately and never counts successful sign-ins", async () => {
    await seedUser(container, { email: "jane@example.com", password, roles: ["member"] });
    await failTimes(10, "mallory-target@example.com");

    for (let i = 0; i < 12; i++) {
      const response = await logIn({ email: "jane@example.com", password });
      expect(response.status).toBe(200);
    }
  });

  it("matches the account however the email is typed", async () => {
    await failTimes(10, "Jane@Example.com ");

    await expect(logIn({ email: "jane@example.com", password })).resolves.toMatchObject({
      status: 429,
    });
  });

  it("stops one address flooding sign-up emails to the same inbox", async () => {
    const signUp = () =>
      request(container.app)
        .post("/auth/signup")
        .send({ email: "victim@example.com", name: "Victim", password });

    for (let i = 0; i < 3; i++) await signUp();
    const fourth = await signUp();

    expect(fourth.status).toBe(429);
    expect(email.sent).toHaveLength(3);
  });

  it("does not rate limit requests that fail validation", async () => {
    for (let i = 0; i < 12; i++) {
      await logIn({ email: "not-an-email", password: "x" });
    }

    await expect(logIn({ email: "jane@example.com", password: "x" })).resolves.toMatchObject({
      status: 401,
    });
  });
});
