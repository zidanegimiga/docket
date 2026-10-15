import { beforeEach, describe, expect, it } from "vitest";

import { TicketService } from "../../src/modules/tickets/ticket.service.js";
import { NotFoundError } from "../../src/shared/errors/not-found.error.js";
import { InMemoryTicketRepository } from "../helpers/in-memory-ticket.repository.js";
import { RecordingMonitor } from "../helpers/recording.monitor.js";

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
      const ticket = await service.create({ title: "Printer jammed", priority: "high" });

      expect(ticket).toMatchObject({ title: "Printer jammed", priority: "high", status: "open" });
      expect(repository.tickets).toEqual([ticket]);
    });

    it("records a tickets.created metric tagged with the priority", async () => {
      await service.create({ title: "VPN drops", priority: "low" });

      expect(monitor.metrics).toEqual([
        { name: "tickets.created", value: 1, tags: { priority: "low" } },
      ]);
    });

    it("does not record a metric when persisting fails", async () => {
      repository.create = () => Promise.reject(new Error("connection lost"));

      await expect(service.create({ title: "Lost", priority: "medium" })).rejects.toThrow(
        "connection lost",
      );
      expect(monitor.metrics).toEqual([]);
    });
  });

  describe("list", () => {
    it("wraps the repository page in a pagination envelope", async () => {
      for (const title of ["First", "Second", "Third"]) {
        await service.create({ title, priority: "medium" });
      }

      const result = await service.list({ page: 1, limit: 2 });

      expect(result.data).toHaveLength(2);
      expect(result.pagination).toEqual({ page: 1, limit: 2, total: 3, totalPages: 2 });
    });

    it("passes the status filter through to the repository", async () => {
      await service.create({ title: "Open one", priority: "low" });

      const result = await service.list({ status: "closed", page: 1, limit: 20 });

      expect(result).toEqual({
        data: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });
    });
  });

  describe("update", () => {
    it("changes only the submitted fields", async () => {
      const created = await service.create({ title: "VPN drops", priority: "low" });

      const updated = await service.update(created.id, { priority: "high" });

      expect(updated).toMatchObject({ id: created.id, status: "open", priority: "high" });
    });

    it("throws NotFoundError for an unknown ticket", async () => {
      const error = await service.update(404, { status: "closed" }).catch((caught) => caught);

      expect(error).toBeInstanceOf(NotFoundError);
      expect(error).toMatchObject({ statusCode: 404, message: "Ticket 404 was not found" });
    });

    it("records a status metric only when a status is submitted", async () => {
      const created = await service.create({ title: "Projector", priority: "medium" });
      monitor.metrics.length = 0;

      await service.update(created.id, { priority: "high" });
      await service.update(created.id, { status: "closed" });

      expect(monitor.metrics).toEqual([
        { name: "tickets.status_updated", value: 1, tags: { status: "closed" } },
      ]);
    });
  });
});
