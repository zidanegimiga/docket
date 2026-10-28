import { beforeEach, describe, expect, it } from "vitest";

import type { Principal } from "../../src/core/identity/principal.js";
import { TicketService } from "../../src/modules/tickets/ticket.service.js";
import { NotFoundError } from "../../src/shared/errors/not-found.error.js";
import { InMemoryTicketRepository } from "../helpers/in-memory-ticket.repository.js";
import { RecordingMonitor } from "../helpers/recording.monitor.js";

const member: Principal = {
  userId: "0199c3a2-6f1e-7c3a-9b1d-2f4e6a8c0d01",
  status: "active",
  permissions: ["tickets:read", "tickets:create", "tickets:update:own"],
};
const colleague: Principal = { ...member, userId: "0199c3a2-6f1e-7c3a-9b1d-2f4e6a8c0d02" };
const admin: Principal = {
  ...member,
  userId: "0199c3a2-6f1e-7c3a-9b1d-2f4e6a8c0d03",
  permissions: [...member.permissions, "tickets:update:any"],
};

describe("TicketService", () => {
  let repository: InMemoryTicketRepository;
  let monitor: RecordingMonitor;
  let service: TicketService;

  beforeEach(() => {
    repository = new InMemoryTicketRepository();
    monitor = new RecordingMonitor();
    service = new TicketService(repository, monitor);
  });

  describe("create", () => {
    it("persists the ticket and returns it", async () => {
      const ticket = await service.create({ title: "Printer jammed", priority: "high" }, member);

      expect(ticket).toMatchObject({ title: "Printer jammed", priority: "high", status: "open" });
      expect(repository.tickets).toEqual([ticket]);
    });

    it("records a tickets.created metric tagged with the priority", async () => {
      await service.create({ title: "VPN drops", priority: "low" }, member);

      expect(monitor.metrics).toEqual([
        { name: "tickets.created", value: 1, tags: { priority: "low" } },
      ]);
    });

    it("does not record a metric when persisting fails", async () => {
      repository.create = () => Promise.reject(new Error("connection lost"));

      await expect(service.create({ title: "Lost", priority: "medium" }, member)).rejects.toThrow(
        "connection lost",
      );
      expect(monitor.metrics).toEqual([]);
    });
  });

  describe("list", () => {
    it("wraps the repository page in a pagination envelope", async () => {
      for (const title of ["First", "Second", "Third"]) {
        await service.create({ title, priority: "medium" }, member);
      }

      const result = await service.list({ page: 1, limit: 2 });

      expect(result.data).toHaveLength(2);
      expect(result.pagination).toEqual({ page: 1, limit: 2, total: 3, totalPages: 2 });
    });

    it("passes the status filter through to the repository", async () => {
      await service.create({ title: "Open one", priority: "low" }, member);

      const result = await service.list({ status: "closed", page: 1, limit: 20 });

      expect(result).toEqual({
        data: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });
    });
  });

  describe("update", () => {
    it("changes only the submitted fields", async () => {
      const created = await service.create({ title: "VPN drops", priority: "low" }, member);

      const updated = await service.update(created.id, { priority: "high" }, member);

      expect(updated).toMatchObject({ id: created.id, status: "open", priority: "high" });
    });

    it("throws NotFoundError for an unknown ticket", async () => {
      const error = await service
        .update(404, { status: "closed" }, member)
        .catch((caught) => caught);

      expect(error).toBeInstanceOf(NotFoundError);
      expect(error).toMatchObject({ statusCode: 404, message: "Ticket 404 was not found" });
    });

    it("records a status metric only when a status is submitted", async () => {
      const created = await service.create({ title: "Projector", priority: "medium" }, member);
      monitor.metrics.length = 0;

      await service.update(created.id, { priority: "high" }, member);
      await service.update(created.id, { status: "closed" }, member);

      expect(monitor.metrics).toEqual([
        { name: "tickets.status_updated", value: 1, tags: { status: "closed" } },
      ]);
    });
  });

  describe("ownership", () => {
    it("records who created the ticket", async () => {
      const created = await service.create({ title: "Mine", priority: "low" }, member);

      expect(created.createdById).toBe(member.userId);
    });

    it("refuses an update to someone else's ticket for a caller limited to their own", async () => {
      const created = await service.create({ title: "Mine", priority: "low" }, member);

      await expect(
        service.update(created.id, { status: "closed" }, colleague),
      ).rejects.toMatchObject({ statusCode: 403, code: "NOT_TICKET_OWNER" });
      expect(repository.tickets[0]!.status).toBe("open");
    });

    it("lets a caller with tickets:update:any update anyone's ticket", async () => {
      const created = await service.create({ title: "Mine", priority: "low" }, member);

      await expect(service.update(created.id, { status: "closed" }, admin)).resolves.toMatchObject({
        status: "closed",
      });
    });

    it("still answers 404, not 403, for a ticket that does not exist", async () => {
      await expect(service.update(404, { status: "closed" }, colleague)).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });

    it("refuses an update from a caller without any update permission", async () => {
      const created = await service.create({ title: "Mine", priority: "low" }, member);
      const reader = { ...member, permissions: ["tickets:read" as const] };

      await expect(service.update(created.id, { status: "closed" }, reader)).rejects.toMatchObject({
        statusCode: 403,
        code: "PERMISSION_DENIED",
      });
    });
  });

  describe("stats", () => {
    it("reports every status with zero when there are no tickets", async () => {
      await expect(service.stats()).resolves.toEqual({
        total: 0,
        byStatus: { open: 0, in_progress: 0, closed: 0 },
      });
    });

    it("counts tickets per status and fills in statuses that have none", async () => {
      const first = await service.create({ title: "First", priority: "low" }, member);
      await service.create({ title: "Second", priority: "low" }, member);
      await service.create({ title: "Third", priority: "low" }, member);
      await service.update(first.id, { status: "closed" }, member);

      await expect(service.stats()).resolves.toEqual({
        total: 3,
        byStatus: { open: 2, in_progress: 0, closed: 1 },
      });
    });
  });
});
