import { auditListSchema } from "@docket/contracts";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Container } from "../../src/container.js";
import { promoteToAdmin } from "../../src/modules/identity/admin-promotion.js";
import { seedUser } from "../helpers/seed-users.js";
import { signIn } from "../helpers/sign-in.js";
import { createTestContainer, resetDatabase } from "../helpers/test-app.js";

describe("audit log", () => {
  let container: Container;
  let admin: { user: { id: string }; headers: Record<string, string> };

  beforeAll(async () => {
    container = await createTestContainer();
    await container.database.connect();
  });

  afterAll(async () => {
    await resetDatabase(container);
    await container.database.disconnect();
  });

  beforeEach(async () => {
    await resetDatabase(container);
    admin = await signIn(container, { email: "admin@example.com", roles: ["admin"] });
  });

  const api = () => request(container.app);
  const entries = () =>
    container.database.client.auditEvent.findMany({ orderBy: { occurredAt: "asc" } });
  const roleId = async (name: string) =>
    (await container.database.client.role.findUniqueOrThrow({ where: { name } })).id;

  describe("recording", () => {
    it("records an approval with who, what and the request it came from", async () => {
      const jane = await seedUser(container, { email: "jane@example.com", status: "pending" });

      const response = await api()
        .patch(`/admin/users/${jane.id}`)
        .set(admin.headers)
        .send({ status: "active" });

      await expect(entries()).resolves.toEqual([
        expect.objectContaining({
          action: "user.status_changed",
          actorId: admin.user.id,
          targetType: "user",
          targetId: jane.id,
          targetLabel: "jane@example.com",
          changes: { from: "pending", to: "active" },
          requestId: response.headers["x-request-id"],
        }),
      ]);
    });

    it("records nothing for a change that was refused", async () => {
      const response = await api()
        .patch(`/admin/users/${admin.user.id}`)
        .set(admin.headers)
        .send({ status: "disabled" });

      expect(response.status).toBe(409);
      await expect(entries()).resolves.toEqual([]);
    });

    it("records nothing for a save that changed nothing", async () => {
      const jane = await seedUser(container, { email: "jane@example.com", roles: ["member"] });

      await api()
        .patch(`/admin/users/${jane.id}`)
        .set(admin.headers)
        .send({ status: "active", roleIds: [await roleId("member")] });

      await expect(entries()).resolves.toEqual([]);
    });

    it("records a role's life from creation to deletion", async () => {
      const { body: role } = await api()
        .post("/admin/roles")
        .set(admin.headers)
        .send({ name: "Support", permissions: ["tickets:read"] });
      await api()
        .patch(`/admin/roles/${role.id}`)
        .set(admin.headers)
        .send({ name: "Helpdesk", permissions: ["tickets:read", "tickets:update:any"] });
      await api().delete(`/admin/roles/${role.id}`).set(admin.headers);

      const log = await entries();
      expect(log.map((entry) => [entry.action, entry.targetLabel])).toEqual([
        ["role.created", "Support"],
        ["role.updated", "Helpdesk"],
        ["role.deleted", "Helpdesk"],
      ]);
      expect(log[1]?.changes).toEqual({
        name: { from: "Support", to: "Helpdesk" },
        permissions: { added: ["tickets:update:any"], removed: [] },
      });
    });

    it("records nothing when deleting a role is refused", async () => {
      const response = await api()
        .delete(`/admin/roles/${await roleId("member")}`)
        .set(admin.headers);

      expect(response.status).toBe(409);
      await expect(entries()).resolves.toEqual([]);
    });

    it("records promotion from the command line without an actor", async () => {
      const jane = await seedUser(container, { email: "jane@example.com", status: "pending" });

      await promoteToAdmin(container.database.client, "jane@example.com");
      await promoteToAdmin(container.database.client, "jane@example.com");

      await expect(entries()).resolves.toEqual([
        expect.objectContaining({ action: "user.promoted", actorId: null, targetId: jane.id }),
      ]);
    });

    it("cannot be edited or deleted, even by the application", async () => {
      const jane = await seedUser(container, { email: "jane@example.com", status: "pending" });
      await promoteToAdmin(container.database.client, "jane@example.com");
      const db = container.database.client;

      await expect(
        db.auditEvent.updateMany({ data: { targetLabel: "someone else" } }),
      ).rejects.toThrow(/append-only/);
      await expect(db.auditEvent.deleteMany()).rejects.toThrow(/append-only/);
      await expect(db.auditEvent.count({ where: { targetId: jane.id } })).resolves.toBe(1);
    });
  });

  describe("GET /admin/audit", () => {
    it("lists entries newest first with the actor's email, filterable by action and target", async () => {
      const jane = await seedUser(container, { email: "jane@example.com", status: "pending" });
      const sam = await seedUser(container, { email: "sam@example.com", status: "pending" });
      for (const user of [jane, sam]) {
        await api().patch(`/admin/users/${user.id}`).set(admin.headers).send({ status: "active" });
      }
      await api().post("/admin/roles").set(admin.headers).send({ name: "Ops", permissions: [] });

      const all = auditListSchema.parse((await api().get("/admin/audit").set(admin.headers)).body);
      const forJane = auditListSchema.parse(
        (await api().get("/admin/audit").query({ targetId: jane.id }).set(admin.headers)).body,
      );
      const roleEvents = auditListSchema.parse(
        (await api().get("/admin/audit").query({ action: "role.created" }).set(admin.headers)).body,
      );

      expect(all.data.map((event) => event.target.label)).toEqual([
        "Ops",
        "sam@example.com",
        "jane@example.com",
      ]);
      expect(all.data[0]?.actor).toEqual({ id: admin.user.id, label: "admin@example.com" });
      expect(forJane.data).toHaveLength(1);
      expect(roleEvents.data.map((event) => event.action)).toEqual(["role.created"]);
    });

    it("requires audit:read", async () => {
      await container.database.client.role.create({
        data: { name: "operators", permissions: { create: [{ permission: "users:manage" }] } },
      });
      const operator = await signIn(container, {
        email: "operator@example.com",
        roles: ["operators"],
      });

      const response = await api().get("/admin/audit").set(operator.headers);

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("PERMISSION_DENIED");
    });
  });
});
