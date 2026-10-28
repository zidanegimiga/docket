import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AdminUsers } from "@/features/admin/components/AdminUsers";

import {
  ADMIN_ROLE_ID,
  makeAdminUser,
  makeRoles,
  makeUser,
  MEMBER_ROLE_ID,
} from "../support/fixtures";
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

const grace = makeAdminUser();
const ada = makeAdminUser({
  id: "0199c3a2-6f1e-7c3a-9b1d-2f4e6a8c0d01",
  name: "Ada Lovelace",
  email: "ada@example.com",
  status: "active",
  roles: [{ id: ADMIN_ROLE_ID, name: "admin" }],
  effectivePermissions: ["users:read", "users:manage"],
  lastLoginAt: "2026-10-28T08:15:00.000Z",
});

const page = (users = [grace, ada]) => ({
  data: users,
  pagination: { page: 1, limit: 20, total: users.length, totalPages: 1 },
});

describe("AdminUsers", () => {
  let patches: { id: string; body: unknown }[];

  beforeEach(() => {
    navigation.searchParams = new URLSearchParams();
    navigation.replace.mockReset();
    patches = [];
    server.use(
      http.get("/api/auth/me", () =>
        HttpResponse.json({ user: makeUser({ permissions: ["users:read", "users:manage"] }) }),
      ),
      http.get("/api/admin/users", () => HttpResponse.json(page())),
      http.get("/api/admin/roles", () => HttpResponse.json({ data: makeRoles() })),
      http.patch("/api/admin/users/:id", async ({ params, request }) => {
        const body = await request.json();
        patches.push({ id: String(params["id"]), body });
        return HttpResponse.json({ ...grace, status: "active" });
      }),
    );
  });

  it("lists users with their status, roles and last sign-in", async () => {
    renderWithClient(<AdminUsers />);

    const row = await screen.findByRole("row", { name: /Ada Lovelace/ });
    expect(row).toHaveTextContent("Active");
    expect(row).toHaveTextContent("admin");
    expect(row).toHaveTextContent("28 Oct 2026, 08:15");
    expect(screen.getByRole("row", { name: /Grace Hopper/ })).toHaveTextContent(
      "Waiting for approval",
    );
  });

  it("approves a pending user in one click", async () => {
    renderWithClient(<AdminUsers />);

    await userEvent.click(await screen.findByRole("button", { name: "Approve Grace Hopper" }));

    await vi.waitFor(() => expect(patches).toEqual([{ id: grace.id, body: { status: "active" } }]));
    expect(screen.queryByRole("button", { name: "Approve Ada Lovelace" })).toBeNull();
  });

  it("searches through the URL and starts from the first page", async () => {
    navigation.searchParams = new URLSearchParams("status=pending&page=3");
    renderWithClient(<AdminUsers />);

    await userEvent.type(await screen.findByRole("searchbox"), "grace");
    await userEvent.click(screen.getByRole("button", { name: "Search" }));

    expect(navigation.replace).toHaveBeenCalledWith("/admin/users?status=pending&search=grace", {
      scroll: false,
    });
  });

  it("edits roles, status and extra permissions in one save", async () => {
    navigation.searchParams = new URLSearchParams(`user=${grace.id}`);
    renderWithClient(<AdminUsers />);

    const editor = await screen.findByRole("region", { name: "Grace Hopper" });
    await userEvent.selectOptions(within(editor).getByLabelText("Status"), "active");
    await userEvent.click(within(editor).getByRole("checkbox", { name: "admin" }));
    await userEvent.click(within(editor).getByRole("checkbox", { name: "audit:read" }));
    await userEvent.click(within(editor).getByRole("button", { name: "Save changes" }));

    expect(await within(editor).findByRole("status")).toHaveTextContent("Saved.");
    expect(patches).toEqual([
      {
        id: grace.id,
        body: {
          status: "active",
          roleIds: [ADMIN_ROLE_ID, MEMBER_ROLE_ID],
          directPermissions: ["audit:read"],
        },
      },
    ]);
    expect(within(editor).getByRole("checkbox", { name: "admin" })).toHaveAccessibleDescription(
      "Full access",
    );
  });

  it("explains why the API refused a change", async () => {
    navigation.searchParams = new URLSearchParams(`user=${ada.id}`);
    server.use(
      http.patch("/api/admin/users/:id", () =>
        HttpResponse.json(
          { error: { code: "LAST_ADMIN", message: "At least one active administrator" } },
          { status: 409 },
        ),
      ),
    );
    renderWithClient(<AdminUsers />);

    const editor = await screen.findByRole("region", { name: "Ada Lovelace" });
    await userEvent.click(within(editor).getByRole("button", { name: "Save changes" }));

    expect(await within(editor).findByRole("alert")).toHaveTextContent(
      "At least one active administrator must remain",
    );
  });

  it("only shows what a user with users:read but not users:manage may do", async () => {
    navigation.searchParams = new URLSearchParams(`user=${grace.id}`);
    server.use(
      http.get("/api/auth/me", () =>
        HttpResponse.json({ user: makeUser({ permissions: ["users:read"] }) }),
      ),
    );
    renderWithClient(<AdminUsers />);

    const editor = await screen.findByRole("region", { name: "Grace Hopper" });
    await vi.waitFor(() => expect(within(editor).getByLabelText("Status")).toBeDisabled());
    expect(screen.queryByRole("button", { name: /Approve/ })).toBeNull();
    expect(screen.getByRole("link", { name: "View Ada Lovelace" })).toBeInTheDocument();
    expect(within(editor).queryByRole("button", { name: "Save changes" })).toBeNull();
  });

  it("drops the secondary columns while the editor is open", async () => {
    navigation.searchParams = new URLSearchParams(`user=${grace.id}`);
    renderWithClient(<AdminUsers />);

    await screen.findByRole("region", { name: "Grace Hopper" });
    const headers = within(screen.getByRole("table")).getAllByRole("columnheader");
    expect(headers.map((header) => header.textContent)).toEqual(["Name", "Status", "Actions"]);
  });
});
