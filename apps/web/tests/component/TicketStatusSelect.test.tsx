import { screen, waitFor } from "@testing-library/react";
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

function gate() {
  let open = () => {};
  const opened = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { open, opened };
}

describe("ticket status control", () => {
  it("shows the new status immediately and sends it to the API", async () => {
    const response = gate();
    let body: unknown;
    let listCalls = 0;
    server.use(
      http.get("/api/tickets", () => {
        listCalls += 1;
        const status = listCalls === 1 ? "open" : "in_progress";
        return HttpResponse.json(makeTicketList([makeTicket({ id: 11, status })]));
      }),
      http.patch("/api/tickets/11", async ({ request }) => {
        body = await request.json();
        await response.opened;
        return HttpResponse.json(makeTicket({ id: 11, status: "in_progress" }));
      }),
    );

    renderWithClient(<TicketList />);
    const select = await screen.findByRole("combobox", { name: "Status for ticket #11" });
    await userEvent.selectOptions(select, "in_progress");

    expect(select).toHaveValue("in_progress");
    expect(select).toBeDisabled();
    expect(body).toEqual({ status: "in_progress" });

    response.open();
    await waitFor(() => expect(select).toBeEnabled());
    expect(select).toHaveValue("in_progress");
  });

  it("reverts and explains when the update fails", async () => {
    server.use(
      http.get("/api/tickets", () =>
        HttpResponse.json(makeTicketList([makeTicket({ id: 11, status: "open" })])),
      ),
      http.patch("/api/tickets/11", () =>
        HttpResponse.json({ error: { code: "INTERNAL_ERROR", message: "x" } }, { status: 500 }),
      ),
    );

    renderWithClient(<TicketList />);
    const select = await screen.findByRole("combobox", { name: "Status for ticket #11" });
    await userEvent.selectOptions(select, "closed");

    expect(await screen.findByRole("alert")).toHaveTextContent("Not saved. Try again.");
    expect(select).toHaveValue("open");
    expect(select).toHaveAccessibleDescription("Not saved. Try again.");
  });
});
