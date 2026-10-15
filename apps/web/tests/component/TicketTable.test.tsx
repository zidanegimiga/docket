import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TicketTable } from "@/features/tickets/components/TicketTable";

import { makeTicket } from "../support/fixtures";
import { renderWithClient } from "../support/render";

describe("TicketTable", () => {
  it("renders one row per ticket with its status, priority and date", () => {
    renderWithClient(
      <TicketTable
        emptyMessage="No tickets yet."
        tickets={[
          makeTicket({
            id: 14,
            title: "Payroll export fails",
            description: "CSV returns a 500",
            status: "in_progress",
            priority: "high",
          }),
          makeTicket({
            id: 13,
            title: "Projector has no signal",
            status: "closed",
            priority: "low",
          }),
        ]}
      />,
    );

    const rows = within(screen.getByRole("table")).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("14");
    expect(rows[0]).toHaveTextContent("Payroll export fails");
    expect(rows[0]).toHaveTextContent("CSV returns a 500");
    expect(screen.getByRole("combobox", { name: "Status for ticket #14" })).toHaveValue(
      "in_progress",
    );
    expect(rows[0]).toHaveTextContent("High");
    expect(rows[0]).toHaveTextContent("15 Oct 2026, 07:42");
    expect(screen.getByRole("combobox", { name: "Status for ticket #13" })).toHaveValue("closed");
  });

  it("shows the empty message instead of a table when there are no tickets", () => {
    renderWithClient(<TicketTable tickets={[]} emptyMessage="No closed tickets." />);

    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByText("No closed tickets.")).toBeInTheDocument();
  });

  it("marks the table busy while a newer page is loading", () => {
    renderWithClient(<TicketTable tickets={[makeTicket()]} emptyMessage="" stale />);

    expect(screen.getByRole("table")).toHaveAttribute("aria-busy", "true");
  });
});
