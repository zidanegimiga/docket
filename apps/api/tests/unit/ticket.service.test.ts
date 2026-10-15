import { beforeEach, describe, expect, it } from "vitest";

import { TicketService } from "../../src/modules/tickets/ticket.service.js";
import { InMemoryTicketRepository } from "../helpers/in-memory-ticket.repository.js";
import { RecordingMonitor } from "../helpers/recording.monitor.js";

describe("TicketService.create", () => {
  let repository: InMemoryTicketRepository;
  let monitor: RecordingMonitor;
  let service: TicketService;

  beforeEach(() => {
    repository = new InMemoryTicketRepository();
    monitor = new RecordingMonitor();
    service = new TicketService(repository, monitor);
  });

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
