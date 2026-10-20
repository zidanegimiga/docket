import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { ticketKeys } from "@/features/tickets/api/ticket.keys";
import { CreateTicketForm } from "@/features/tickets/components/CreateTicketForm";

import { makeTicket, makeTicketList } from "../support/fixtures";
import { renderWithClient } from "../support/render";
import { server } from "../support/server";

describe("CreateTicketForm", () => {
  it("shows a field error without calling the API when the title is blank", async () => {
    let requests = 0;
    server.use(
      http.post("/api/tickets", () => {
        requests += 1;
        return HttpResponse.json(makeTicket(), { status: 201 });
      }),
    );

    renderWithClient(<CreateTicketForm />);
    await userEvent.type(screen.getByLabelText("Title"), "   ");
    await userEvent.click(screen.getByRole("button", { name: "Create ticket" }));

    expect(screen.getByLabelText("Title")).toHaveAccessibleDescription("Title is required");
    expect(screen.getByLabelText("Title")).toBeInvalid();
    expect(requests).toBe(0);
  });

  it("places the API's validation errors under the matching fields", async () => {
    server.use(
      http.post("/api/tickets", () =>
        HttpResponse.json(
          {
            error: {
              code: "VALIDATION_FAILED",
              message: "Request validation failed",
              details: [{ path: "body.title", message: "A ticket with this title already exists" }],
            },
          },
          { status: 400 },
        ),
      ),
    );

    renderWithClient(<CreateTicketForm />);
    await userEvent.type(screen.getByLabelText("Title"), "Printer jammed");
    await userEvent.click(screen.getByRole("button", { name: "Create ticket" }));

    expect(await screen.findByText("A ticket with this title already exists")).toBeInTheDocument();
    expect(screen.getByLabelText("Title")).toHaveAccessibleDescription(
      "A ticket with this title already exists",
    );
  });

  it("creates the ticket, resets the form and refreshes ticket lists", async () => {
    let body: unknown;
    server.use(
      http.post("/api/tickets", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(makeTicket({ id: 12, title: "VPN drops", priority: "high" }), {
          status: 201,
        });
      }),
      http.get("/api/tickets", () => HttpResponse.json(makeTicketList([]))),
    );
    const { client } = renderWithClient(<CreateTicketForm />);
    const listKey = ticketKeys.list({ page: 1, limit: 20 });
    client.setQueryData(listKey, makeTicketList([]));

    await userEvent.type(screen.getByLabelText("Title"), "  VPN drops  ");
    await userEvent.selectOptions(screen.getByLabelText("Priority"), "high");
    await userEvent.click(screen.getByRole("button", { name: "Create ticket" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Ticket #12 created.");
    expect(body).toEqual({ title: "VPN drops", priority: "high" });
    expect(screen.getByLabelText("Title")).toHaveValue("");
    expect(screen.getByLabelText("Priority")).toHaveValue("medium");
    expect(client.getQueryState(listKey)?.isInvalidated).toBe(true);
  });

  it("shows a reference the user can quote when the server fails", async () => {
    server.use(
      http.post("/api/tickets", () =>
        HttpResponse.json(
          {
            error: {
              code: "INTERNAL_ERROR",
              message: "An unexpected error occurred",
              requestId: "3f9c2e71-5d0a-4e8b",
            },
          },
          { status: 500 },
        ),
      ),
    );

    renderWithClient(<CreateTicketForm />);
    await userEvent.type(screen.getByLabelText("Title"), "Payroll export fails");
    await userEvent.click(screen.getByRole("button", { name: "Create ticket" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The ticket could not be created. Reference: 3f9c2e71",
    );
    expect(screen.getByLabelText("Title")).toHaveValue("Payroll export fails");
  });
});
