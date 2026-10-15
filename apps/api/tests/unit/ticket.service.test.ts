import { beforeEach, describe, expect, it } from "vitest";

import { TicketService } from "../../src/modules/tickets/ticket.service.js";
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
});
