import { userListSchema, type UserStatus } from "@docket/contracts";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Container } from "../../src/container.js";
import { seedUser } from "../helpers/seed-users.js";
import { signIn } from "../helpers/sign-in.js";
import { createTestContainer, resetDatabase } from "../helpers/test-app.js";

describe("GET /admin/users", () => {
  let container: Container;
  let admin: Record<string, string>;

  beforeAll(async () => {
    container = await createTestContainer();
    await container.database.connect();
  });

  afterAll(async () => {
    await container.database.disconnect();
  });

  beforeEach(async () => {
    await resetDatabase(container);
    ({ headers: admin } = await signIn(container, {
      email: "admin@example.com",
      name: "Ada Admin",
      roles: ["admin"],
    }));
  });

  const list = (query = "", headers = admin) =>
    request(container.app).get(`/admin/users${query}`).set(headers);

  /** Seeds a user created a given number of minutes ago, so ordering is deterministic. */
  const seedAged = async (email: string, status: UserStatus, minutesAgo: number, name = "User") => {
    const user = await seedUser(container, { email, name, status, roles: ["member"] });
    await container.database.client.user.update({
      where: { id: user.id },
      data: { createdAt: new Date(Date.now() - minutesAgo * 60_000) },
    });
    return user;
  };

  it("requires sign-in and users:read", async () => {
    const { headers: member } = await signIn(container, { email: "member@example.com" });

    await expect(request(container.app).get("/admin/users")).resolves.toMatchObject({
      status: 401,
    });
    const denied = await list("", member);
    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe("PERMISSION_DENIED");
  });

  it("returns users in the documented shape without any password data", async () => {
    await seedUser(container, { email: "jane@example.com", password: "correct horse battery" });

    const response = await list();

    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    const body = userListSchema.parse(response.body);
    const jane = body.data.find((user) => user.email === "jane@example.com")!;
    expect(Object.keys(jane).sort()).toEqual(
      [
        "createdAt",
        "directPermissions",
        "effectivePermissions",
        "email",
        "hasPassword",
        "id",
        "lastLoginAt",
        "name",
        "providers",
        "roles",
        "status",
      ].sort(),
    );
    expect(jane.hasPassword).toBe(true);
    expect(JSON.stringify(response.body)).not.toContain("argon2");
  });

  it("puts pending users first, then the newest", async () => {
    await seedAged("old-active@example.com", "active", 30);
    await seedAged("new-active@example.com", "active", 5);
    await seedAged("old-pending@example.com", "pending", 20);
    await seedAged("new-pending@example.com", "pending", 10);
    await seedAged("disabled@example.com", "disabled", 1);

    const response = await list();

    expect(response.body.data.map((user: { email: string }) => user.email)).toEqual([
      "new-pending@example.com",
      "old-pending@example.com",
      "admin@example.com",
      "new-active@example.com",
      "old-active@example.com",
      "disabled@example.com",
    ]);
  });

  it("filters by status and paginates", async () => {
    for (let i = 1; i <= 3; i++) await seedAged(`pending${i}@example.com`, "pending", i);

    const response = await list("?status=pending&limit=2&page=2");

    expect(response.body.pagination).toEqual({ page: 2, limit: 2, total: 3, totalPages: 2 });
    expect(response.body.data.map((user: { email: string }) => user.email)).toEqual([
      "pending3@example.com",
    ]);
  });

  it.each([
    ["part of a name, ignoring case", "LOVELACE", ["ada@lovelace.dev"]],
    ["part of an email", "hopper", ["grace@hopper.dev"]],
    ["a literal percent sign", "%", ["percent%sign@example.com"]],
    ["a literal underscore", "_", ["under_score@example.com"]],
    ["a literal backslash", "\\", ["back\\slash@example.com"]],
  ])("searches %s", async (_, search, expected) => {
    await seedAged("ada@lovelace.dev", "active", 1, "Ada Lovelace");
    await seedAged("grace@hopper.dev", "active", 2, "Grace");
    await seedAged("percent%sign@example.com", "active", 3);
    await seedAged("under_score@example.com", "active", 4);
    await seedAged("back\\slash@example.com", "active", 5);

    const response = await list(`?search=${encodeURIComponent(search)}`);

    expect(response.body.data.map((user: { email: string }) => user.email)).toEqual(expected);
  });

  it("shows roles, direct grants and what they add up to", async () => {
    const jane = await seedUser(container, { email: "jane@example.com", roles: ["member"] });
    await container.database.client.userPermission.create({
      data: { userId: jane.id, permission: "audit:read" },
    });
    await container.database.client.userIdentity.create({
      data: { userId: jane.id, provider: "google", subject: "g-1", email: "jane@example.com" },
    });
    const pending = await seedUser(container, {
      email: "pending@example.com",
      status: "pending",
      roles: ["member"],
    });

    const { body } = await list();
    const find = (id: string) => body.data.find((user: { id: string }) => user.id === id);

    expect(find(jane.id)).toMatchObject({
      roles: [{ name: "member" }],
      directPermissions: ["audit:read"],
      effectivePermissions: ["tickets:read", "tickets:create", "tickets:update:own", "audit:read"],
      providers: ["google"],
      hasPassword: false,
    });
    // Status gates everything: a pending member holds nothing yet.
    expect(find(pending.id)).toMatchObject({
      roles: [{ name: "member" }],
      effectivePermissions: [],
    });
  });

  it.each(["?status=archived", "?limit=1000", `?search=${"x".repeat(101)}`])(
    "rejects an invalid query (%s)",
    async (query) => {
      await expect(list(query)).resolves.toMatchObject({ status: 400 });
    },
  );
});
