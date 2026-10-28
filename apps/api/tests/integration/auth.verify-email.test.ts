import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Container } from "../../src/container.js";
import { RecordingEmailSender } from "../helpers/recording.email-sender.js";
import { createTestContainer, resetDatabase, TEST_WEB_ORIGIN } from "../helpers/test-app.js";

describe("GET /auth/verify-email", () => {
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

  /** Signs up through the API and returns the verification link from the welcome email. */
  const signUpAndOpenInbox = async () => {
    await request(container.app)
      .post("/auth/signup")
      .send({ email: "jane@example.com", name: "Jane Doe", password: "correct horse battery" });
    const link = /https?:\/\/\S+verify-email\?token=\S+/.exec(email.sent[0]!.text)?.[0];
    return new URL(link!);
  };

  const open = (link: URL) => request(container.app).get(`${link.pathname}${link.search}`);

  const verifiedAt = async () =>
    (
      await container.database.client.user.findUniqueOrThrow({
        where: { email: "jane@example.com" },
      })
    ).emailVerifiedAt;

  it("emails a link on the web app's origin", async () => {
    const link = await signUpAndOpenInbox();

    expect(link.origin).toBe(TEST_WEB_ORIGIN);
    expect(link.searchParams.get("token")).toMatch(/^[A-Za-z0-9_-]{43}$/);
    await expect(container.database.client.verificationToken.count()).resolves.toBe(1);
  });

  it("verifies the email and sends the user to log in", async () => {
    const link = await signUpAndOpenInbox();

    const response = await open(link);

    expect(response.status).toBe(303);
    expect(response.headers["location"]).toBe(`${TEST_WEB_ORIGIN}/login?verified=1`);
    expect(response.headers["cache-control"]).toBe("no-store");
    await expect(verifiedAt()).resolves.toBeInstanceOf(Date);
  });

  it("still succeeds when the link is opened a second time", async () => {
    const link = await signUpAndOpenInbox();
    await open(link);

    const again = await open(link);

    expect(again.headers["location"]).toBe(`${TEST_WEB_ORIGIN}/login?verified=1`);
  });

  it("does not verify with an expired link", async () => {
    const link = await signUpAndOpenInbox();
    const twoDaysAgo = new Date(Date.now() - 2 * 86_400_000);
    await container.database.client.verificationToken.updateMany({
      data: { createdAt: twoDaysAgo, expiresAt: new Date(twoDaysAgo.getTime() + 86_400_000) },
    });

    const response = await open(link);

    expect(response.headers["location"]).toBe(
      `${TEST_WEB_ORIGIN}/login?error=VERIFICATION_LINK_EXPIRED`,
    );
    await expect(verifiedAt()).resolves.toBeNull();
  });

  it.each([
    ["a made-up token", "?token=" + "A".repeat(43)],
    ["a malformed token", "?token=%27%20OR%201%3D1"],
    ["no token", ""],
  ])("rejects %s", async (_, query) => {
    await signUpAndOpenInbox();

    const response = await request(container.app).get(`/auth/verify-email${query}`);

    expect(response.headers["location"]).toBe(
      `${TEST_WEB_ORIGIN}/login?error=VERIFICATION_LINK_INVALID`,
    );
    await expect(verifiedAt()).resolves.toBeNull();
  });
});
