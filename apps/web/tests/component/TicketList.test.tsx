import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TicketList } from "@/features/tickets/components/TicketList";

import { makeTicket, makeTicketList } from "../support/fixtures";
import { renderWithClient } from "../support/render";
import { server } from "../support/server";

const navigation = vi.hoisted(() => ({ searchParams: new URLSearchParams() }));

vi.mock("next/navigation", () => ({
  useSearchParams: () => navigation.searchParams,
}));

describe("TicketList", () => {
  beforeEach(() => {
    navigation.searchParams = new URLSearchParams();
  });

  it("shows tickets from the API with a count and pager links", async () => {
    server.use(
      http.get("/api/tickets", () =>
        HttpResponse.json(
          makeTicketList([makeTicket({ id: 3, title: "VPN drops every hour" })], {
            total: 41,
            totalPages: 3,
          }),
        ),
      ),
    );

    renderWithClient(<TicketList />);

    expect(await screen.findByText("VPN drops every hour")).toBeInTheDocument();
    expect(screen.getByText("41 tickets")).toBeInTheDocument();
    expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Next" })).toHaveAttribute("href", "/?page=2");
  });

  it("sends the status from the URL and explains an empty filter", async () => {
    navigation.searchParams = new URLSearchParams("status=closed");
    let requestedStatus: string | null = null;
    server.use(
      http.get("/api/tickets", ({ request }) => {
        requestedStatus = new URL(request.url).searchParams.get("status");
        return HttpResponse.json(makeTicketList([]));
      }),
    );

    renderWithClient(<TicketList />);

    expect(await screen.findByText("No closed tickets.")).toBeInTheDocument();
    expect(requestedStatus).toBe("closed");
    expect(screen.getByRole("link", { name: "Closed" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "All" })).not.toHaveAttribute("aria-current");
  });

  it("explains a page past the end without hiding the pager", async () => {
    navigation.searchParams = new URLSearchParams("page=5");
    server.use(
      http.get("/api/tickets", () =>
        HttpResponse.json(makeTicketList([], { page: 5, total: 2, totalPages: 1 })),
      ),
    );

    renderWithClient(<TicketList />);

    expect(await screen.findByText("No tickets on this page.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Previous" })).toHaveAttribute("href", "/?page=4");
  });

  it("offers a retry when the list cannot be loaded", async () => {
    let calls = 0;
    server.use(
      http.get("/api/tickets", () => {
        calls += 1;
        return calls === 1
          ? HttpResponse.json({ error: { code: "INTERNAL_ERROR", message: "x" } }, { status: 500 })
          : HttpResponse.json(makeTicketList([makeTicket({ title: "Back online" })]));
      }),
    );

    renderWithClient(<TicketList />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Tickets could not be loaded.");
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Back online")).toBeInTheDocument();
  });
});
