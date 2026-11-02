import type { AuditEvent } from "@docket/contracts";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuditLog } from "@/features/admin/components/AuditLog";

import { renderWithClient } from "../support/render";
import { server } from "../support/server";

const navigation = vi.hoisted(() => ({
  searchParams: new URLSearchParams(),
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => navigation.searchParams,
  useRouter: () => ({ replace: navigation.replace }),
}));

const events: AuditEvent[] = [
  {
    id: "0199c3a2-0000-7000-8000-000000000011",
    occurredAt: "2026-11-02T10:47:00.000Z",
    actor: { id: "0199c3a2-0000-7000-8000-000000000001", label: "ada@example.com" },
    target: { type: "user", id: "0199c3a2-0000-7000-8000-000000000002", label: "jane@example.com" },
    requestId: "5fa1d2ce-7d0c-4b55-9a6c-0d1bbd6b1a11",
    action: "user.status_changed",
    changes: { from: "pending", to: "active" },
  },
  {
    id: "0199c3a2-0000-7000-8000-000000000012",
    occurredAt: "2026-11-01T08:00:00.000Z",
    actor: null,
    target: { type: "user", id: "0199c3a2-0000-7000-8000-000000000001", label: "ada@example.com" },
    requestId: null,
    action: "user.promoted",
    changes: {},
  },
];

describe("AuditLog", () => {
  let requestedQueries: string[];

  beforeEach(() => {
    navigation.searchParams = new URLSearchParams();
    navigation.replace.mockReset();
    requestedQueries = [];
    server.use(
      http.get("/api/admin/audit", ({ request }) => {
        requestedQueries.push(new URL(request.url).search);
        return HttpResponse.json({
          data: events,
          pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
        });
      }),
    );
  });

  it("shows when, who and what for each change", async () => {
    renderWithClient(<AuditLog />);

    const approval = await screen.findByRole("row", { name: /Approved jane@example.com/ });
    expect(
      within(approval)
        .getAllByRole("cell")
        .map((cell) => cell.textContent),
    ).toEqual(["2 Nov 2026, 10:47", "ada@example.com", "Approved jane@example.com", "5fa1d2ce"]);
    expect(
      screen.getByRole("row", { name: /Made ada@example.com an administrator/ }),
    ).toHaveTextContent("Command line");
  });

  it("filters by kind of change through the URL", async () => {
    navigation.searchParams = new URLSearchParams("page=3");
    renderWithClient(<AuditLog />);

    await userEvent.selectOptions(await screen.findByLabelText("Show"), "role.deleted");

    expect(navigation.replace).toHaveBeenCalledWith("/admin/audit?action=role.deleted", {
      scroll: false,
    });
  });

  it("asks the API for the filtered view from the URL", async () => {
    navigation.searchParams = new URLSearchParams("action=user.promoted&page=2");
    renderWithClient(<AuditLog />);

    await screen.findByRole("table");
    expect(requestedQueries).toEqual(["?action=user.promoted&page=2&limit=20"]);
    expect(screen.getByLabelText("Show")).toHaveValue("user.promoted");
  });
});
