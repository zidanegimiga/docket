import { roleSchema } from "@docket/contracts";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Container } from "../../src/container.js";
import { seedUser } from "../helpers/seed-users.js";
import { signIn } from "../helpers/sign-in.js";
import { createTestContainer, resetDatabase } from "../helpers/test-app.js";

describe("role management", () => {
  let container: Container;
  let admin: Record<string, string>;

  beforeAll(async () => {
    container = await createTestContainer();
    await container.database.connect();
  });

  afterAll(async () => {
    // Some tests edit the built-in roles; leave them as the migrations made them.
    await resetDatabase(container);
    await container.database.disconnect();
  });

  beforeEach(async () => {
    await resetDatabase(container);
    ({ headers: admin } = await signIn(container, {
      email: "admin@example.com",
      roles: ["admin"],
    }));
  });

  const api = () => request(container.app);
  const createRole = (body: object, headers = admin) =>
    api().post("/admin/roles").set(headers).send(body);
  const roleId = async (name: string) =>
    (await container.database.client.role.findUniqueOrThrow({ where: { name } })).id;

  describe("POST /admin/roles", () => {
    it("creates a role with de-duplicated permissions", async () => {
      const response = await createRole({
        name: "Support desk",
        description: "  Answers tickets  ",
        permissions: ["tickets:read", "tickets:update:any", "tickets:read"],
      });

      expect(response.status).toBe(201);
      expect(roleSchema.parse(response.body)).toMatchObject({
        name: "Support desk",
        description: "Answers tickets",
        permissions: ["tickets:read", "tickets:update:any"],
        isSystem: false,
        userCount: 0,
      });
    });

    it("treats names that differ only in case as the same", async () => {
      const response = await createRole({ name: "ADMIN", permissions: [] });

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe("ROLE_NAME_TAKEN");
    });

    it.each([
      ["a name with symbols", { name: "<script>", permissions: [] }],
      ["an unknown permission", { name: "Ops", permissions: ["tickets:delete"] }],
      ["a request to make it built in", { name: "Ops", permissions: [], isSystem: true }],
    ])("rejects %s", async (_, body) => {
      await expect(createRole(body)).resolves.toMatchObject({ status: 400 });
      await expect(container.database.client.role.count()).resolves.toBe(2);
    });

    it("requires roles:manage", async () => {
      const { headers } = await signIn(container, { email: "member@example.com" });

      const response = await createRole({ name: "Ops", permissions: [] }, headers);

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("PERMISSION_DENIED");
    });
  });

  describe("PATCH /admin/roles/:id", () => {
    const patch = (id: string, body: object) =>
      api().patch(`/admin/roles/${id}`).set(admin).send(body);

    it("renames a custom role and replaces its permissions", async () => {
      const { body: created } = await createRole({ name: "Ops", permissions: ["tickets:read"] });

      const response = await patch(created.id, {
        name: "Operations",
        permissions: ["users:read"],
      });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ name: "Operations", permissions: ["users:read"] });
    });

    it("refuses a name another role has in a different case", async () => {
      const { body: created } = await createRole({ name: "Ops", permissions: [] });

      const response = await patch(created.id, { name: "Member" });

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe("ROLE_NAME_TAKEN");
    });

    it("protects the built-in roles", async () => {
      const rename = await patch(await roleId("member"), { name: "staff" });
      const shrinkAdmin = await patch(await roleId("admin"), { permissions: ["users:manage"] });

      expect([rename.status, shrinkAdmin.status]).toEqual([409, 409]);
      expect(rename.body.error.code).toBe("SYSTEM_ROLE");
      const adminRole = await container.database.client.rolePermission.count({
        where: { role: { name: "admin" } },
      });
      expect(adminRole).toBeGreaterThan(1);
    });

    it("changes member's permissions for everyone who holds it", async () => {
      const jane = await seedUser(container, { email: "jane@example.com", roles: ["member"] });

      await patch(await roleId("member"), { permissions: ["tickets:read"] });

      const { body } = await api().get("/admin/users").query({ search: "jane" }).set(admin);
      expect(body.data[0]).toMatchObject({ id: jane.id, effectivePermissions: ["tickets:read"] });
    });

    it("answers 404 for an unknown role", async () => {
      await expect(
        patch("0199c3a2-0000-7000-8000-0000000000ee", { description: "x" }),
      ).resolves.toMatchObject({ status: 404 });
    });
  });

  describe("DELETE /admin/roles/:id", () => {
    const remove = (id: string) => api().delete(`/admin/roles/${id}`).set(admin);

    it("deletes a custom role nobody holds", async () => {
      const { body: created } = await createRole({ name: "Ops", permissions: ["tickets:read"] });

      await expect(remove(created.id)).resolves.toMatchObject({ status: 204 });
      await expect(
        container.database.client.role.count({ where: { id: created.id } }),
      ).resolves.toBe(0);
    });

    it("keeps a role that someone still holds", async () => {
      const { body: created } = await createRole({ name: "Ops", permissions: [] });
      await seedUser(container, { email: "jane@example.com", roles: ["Ops"] });

      const response = await remove(created.id);

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe("ROLE_IN_USE");
      expect(response.body.error.message).toContain("1 person");
    });

    it("never deletes a built-in role", async () => {
      const response = await remove(await roleId("member"));

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe("SYSTEM_ROLE");
    });

    it("answers 404 for an unknown role", async () => {
      await expect(remove("0199c3a2-0000-7000-8000-0000000000ee")).resolves.toMatchObject({
        status: 404,
      });
    });
  });
});
