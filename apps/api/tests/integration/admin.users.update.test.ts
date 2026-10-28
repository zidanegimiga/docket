import { adminUserSchema, roleListSchema } from "@docket/contracts";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Container } from "../../src/container.js";
import { RecordingEmailSender } from "../helpers/recording.email-sender.js";
import { seedUser } from "../helpers/seed-users.js";
import { signIn } from "../helpers/sign-in.js";
import { createTestContainer, resetDatabase, TEST_WEB_ORIGIN } from "../helpers/test-app.js";

describe("PATCH /admin/users/:id", () => {
  let container: Container;
  const email = new RecordingEmailSender();
  let admin: { user: { id: string }; headers: Record<string, string> };

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
    admin = await signIn(container, { email: "admin@example.com", roles: ["admin"] });
  });

  const patch = (id: string, body: object, headers = admin.headers) =>
    request(container.app).patch(`/admin/users/${id}`).set(headers).send(body);

  const roleId = async (name: string) =>
    (await container.database.client.role.findUniqueOrThrow({ where: { name } })).id;

  const stored = (id: string) =>
    container.database.client.user.findUniqueOrThrow({
      where: { id },
      select: { status: true, roles: { select: { role: { select: { name: true } } } } },
    });

  it("approves a pending user, returns them and tells them by email", async () => {
    const pending = await seedUser(container, {
      email: "jane@example.com",
      status: "pending",
      roles: ["member"],
    });

    const response = await patch(pending.id, { status: "active" });

    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(adminUserSchema.parse(response.body)).toMatchObject({
      status: "active",
      effectivePermissions: ["tickets:read", "tickets:create", "tickets:update:own"],
    });
    expect(email.sent).toEqual([
      expect.objectContaining({ to: "jane@example.com", subject: "Your Docket account is ready" }),
    ]);
  });

  it("replaces roles and direct permissions", async () => {
    const jane = await seedUser(container, { email: "jane@example.com", roles: ["member"] });

    const response = await patch(jane.id, {
      roleIds: [await roleId("admin")],
      directPermissions: ["audit:read", "audit:read"],
    });

    expect(response.body.roles.map((role: { name: string }) => role.name)).toEqual(["admin"]);
    expect(response.body.directPermissions).toEqual(["audit:read"]);
    expect(email.sent).toEqual([]);
  });

  it("ends a disabled user's sessions immediately", async () => {
    await seedUser(container, {
      email: "jane@example.com",
      password: "correct horse battery",
      roles: ["member"],
    });
    const browser = request.agent(container.app).set("Origin", TEST_WEB_ORIGIN);
    const login = await browser
      .post("/auth/login")
      .send({ email: "jane@example.com", password: "correct horse battery" });

    await patch(login.body.user.id, { status: "disabled" });

    // Revoked by the update itself, before the user's browser tries anything.
    await expect(
      container.database.client.refreshToken.count({
        where: { userId: login.body.user.id, revokedAt: null },
      }),
    ).resolves.toBe(0);
    await expect(browser.post("/auth/refresh")).resolves.toMatchObject({ status: 401 });
  });

  it.each([
    ["their own account", { status: "disabled" }],
    ["their own admin role", "member-only"],
  ])("stops an administrator from removing %s", async (_, body) => {
    const change = body === "member-only" ? { roleIds: [await roleId("member")] } : body;

    const response = await patch(admin.user.id, change as object);

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("CANNOT_CHANGE_OWN_ACCESS");
    await expect(stored(admin.user.id)).resolves.toMatchObject({
      status: "active",
      roles: [{ role: { name: "admin" } }],
    });
  });

  it("keeps the last active administrator", async () => {
    // Someone who can manage users without being an administrator themselves.
    await container.database.client.role.create({
      data: {
        name: "operators",
        permissions: { create: [{ permission: "users:read" }, { permission: "users:manage" }] },
      },
    });
    const operator = await signIn(container, {
      email: "operator@example.com",
      roles: ["operators"],
    });

    const response = await patch(admin.user.id, { status: "disabled" }, operator.headers);

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("LAST_ADMIN");
    await expect(stored(admin.user.id)).resolves.toMatchObject({ status: "active" });
  });

  it("never lets two administrators disable each other at the same moment", async () => {
    const other = await signIn(container, { email: "other@example.com", roles: ["admin"] });

    const results = await Promise.all([
      patch(other.user.id, { status: "disabled" }),
      patch(admin.user.id, { status: "disabled" }, other.headers),
    ]);

    expect(results.map((response) => response.status).sort()).toEqual([200, 409]);
    await expect(
      container.database.client.user.count({
        where: { status: "active", roles: { some: { role: { name: "admin" } } } },
      }),
    ).resolves.toBe(1);
  });

  it.each([
    ["an unknown role", async () => ({ roleIds: ["0199c3a2-0000-7000-8000-0000000000ff"] })],
    ["an unknown permission", async () => ({ directPermissions: ["tickets:delete"] })],
    ["no changes", async () => ({})],
    ["an unexpected field", async () => ({ status: "active", email: "x@example.com" })],
  ])("rejects %s with 400 and changes nothing", async (_, body) => {
    const jane = await seedUser(container, { email: "jane@example.com", status: "pending" });

    const response = await patch(jane.id, await body());

    expect(response.status).toBe(400);
    await expect(stored(jane.id)).resolves.toMatchObject({ status: "pending" });
  });

  it("answers 404 for an unknown user and 400 for a malformed id", async () => {
    await expect(
      patch("0199c3a2-0000-7000-8000-0000000000ee", { status: "active" }),
    ).resolves.toMatchObject({ status: 404 });
    await expect(patch("42", { status: "active" })).resolves.toMatchObject({ status: 400 });
  });

  it("requires users:manage", async () => {
    const jane = await seedUser(container, { email: "jane@example.com", status: "pending" });
    const member = await signIn(container, { email: "member@example.com" });

    const response = await patch(jane.id, { status: "active" }, member.headers);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("PERMISSION_DENIED");
  });
});

describe("GET /admin/roles", () => {
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

  it("lists roles with their permissions and how many users hold them", async () => {
    const { headers } = await signIn(container, { roles: ["admin"] });
    await seedUser(container, { email: "jane@example.com", roles: ["member"] });

    const response = await request(container.app).get("/admin/roles").set(headers);

    const { data } = roleListSchema.parse(response.body);
    expect(data.map((role) => [role.name, role.isSystem, role.userCount])).toEqual([
      ["admin", true, 1],
      ["member", true, 1],
    ]);
  });

  it("requires users:read", async () => {
    const { headers } = await signIn(container);

    await expect(request(container.app).get("/admin/roles").set(headers)).resolves.toMatchObject({
      status: 403,
    });
  });
});
