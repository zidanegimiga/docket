import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";

import { TicketList } from "@/features/tickets/components/TicketList";

import { makeTicket, makeTicketList } from "../support/fixtures";
import { renderWithClient } from "../support/render";
import { server } from "../support/server";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

const stats = (open: number, inProgress: number, closed: number) => ({
  total: open + inProgress + closed,
  byStatus: { open, in_progress: inProgress, closed },
});

describe("ticket counts in the status filter", () => {
  it("shows the total on All and each status count on its tab", async () => {
    server.use(
      http.get("/api/tickets", () => HttpResponse.json(makeTicketList([makeTicket()]))),
      http.get("/api/tickets/stats", () => HttpResponse.json(stats(6, 0, 3))),
    );

    renderWithClient(<TicketList />);

    expect(await screen.findByRole("link", { name: "All 9" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Open 6" })).toHaveAttribute("href", "/?status=open");
    expect(screen.getByRole("link", { name: "In progress 0" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Closed 3" })).toBeInTheDocument();
  });

  it("keeps the filter working without counts when stats fail", async () => {
    server.use(
      http.get("/api/tickets", () =>
        HttpResponse.json(makeTicketList([makeTicket({ title: "Still listed" })])),
      ),
      http.get("/api/tickets/stats", () =>
        HttpResponse.json({ error: { code: "INTERNAL_ERROR", message: "x" } }, { status: 500 }),
      ),
    );

    renderWithClient(<TicketList />);

    expect(await screen.findByText("Still listed")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Closed" })).toHaveAttribute("href", "/?status=closed");
    expect(screen.getByRole("link", { name: "All" })).toHaveAttribute("aria-current", "page");
  });

  it("refreshes the counts after a status change is saved", async () => {
    let saved = false;
    server.use(
      http.get("/api/tickets", () =>
        HttpResponse.json(
          makeTicketList([makeTicket({ id: 11, status: saved ? "in_progress" : "open" })]),
        ),
      ),
      http.get("/api/tickets/stats", () =>
        HttpResponse.json(saved ? stats(0, 1, 0) : stats(1, 0, 0)),
      ),
      http.patch("/api/tickets/11", () => {
        saved = true;
        return HttpResponse.json(makeTicket({ id: 11, status: "in_progress" }));
      }),
    );

    renderWithClient(<TicketList />);
    expect(await screen.findByRole("link", { name: "Open 1" })).toBeInTheDocument();

    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Status for ticket #11" }),
      "in_progress",
    );

    expect(await screen.findByRole("link", { name: "In progress 1" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open 0" })).toBeInTheDocument();
  });
});
