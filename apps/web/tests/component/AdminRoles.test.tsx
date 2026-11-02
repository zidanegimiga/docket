import type { Role } from "@docket/contracts";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AdminRoles } from "@/features/admin/components/AdminRoles";

import { ADMIN_ROLE_ID, makeRoles, makeUser } from "../support/fixtures";
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

const support: Role = {
  id: "0199c3a2-0000-7000-8000-00000000000c",
  name: "Support desk",
  description: null,
  permissions: ["tickets:read"],
  isSystem: false,
  userCount: 0,
};

describe("AdminRoles", () => {
  let requests: { method: string; path: string; body: unknown }[];
  let roles: Role[];

  beforeEach(() => {
    navigation.searchParams = new URLSearchParams();
    navigation.replace.mockReset();
    requests = [];
    roles = [...makeRoles(), support];
    const record = async (request: Request) => {
      const body = request.method === "DELETE" ? undefined : await request.json();
      requests.push({ method: request.method, path: new URL(request.url).pathname, body });
    };
    server.use(
      http.get("/api/auth/me", () =>
        HttpResponse.json({
          user: makeUser({ permissions: ["users:read", "users:manage", "roles:manage"] }),
        }),
      ),
      http.get("/api/admin/roles", () => HttpResponse.json({ data: roles })),
      http.post("/api/admin/roles", async ({ request }) => {
        await record(request);
        return HttpResponse.json(
          { ...support, id: "0199c3a2-0000-7000-8000-00000000000d", name: "Ops" },
          { status: 201 },
        );
      }),
      http.patch("/api/admin/roles/:id", async ({ request }) => {
        await record(request);
        return HttpResponse.json(roles[0]);
      }),
      http.delete("/api/admin/roles/:id", async ({ request }) => {
        await record(request);
        return new HttpResponse(null, { status: 204 });
      }),
    );
  });

  const open = async (role: string) => {
    navigation.searchParams = new URLSearchParams(`role=${role}`);
    renderWithClient(<AdminRoles />);
    return screen.findByRole("region", {
      name: role === "new" ? "New role" : roles.find((r) => r.id === role)!.name,
    });
  };

  it("lists roles with what they grant and who holds them", async () => {
    renderWithClient(<AdminRoles />);

    const admin = await screen.findByRole("row", { name: /admin Built in/ });
    expect(
      within(admin)
        .getAllByRole("cell")
        .map((cell) => cell.textContent),
    ).toEqual(["admin Built inFull access", "2", "1", "Edit"]);
    expect(screen.getByRole("link", { name: "New role" })).toHaveAttribute(
      "href",
      "/admin/roles?role=new",
    );
  });

  it("creates a role and opens it", async () => {
    const editor = await open("new");

    await userEvent.type(within(editor).getByLabelText("Name"), "Ops");
    await userEvent.click(within(editor).getByRole("checkbox", { name: "users:read" }));
    await userEvent.click(within(editor).getByRole("button", { name: "Create role" }));

    await vi.waitFor(() =>
      expect(navigation.replace).toHaveBeenCalledWith(
        "/admin/roles?role=0199c3a2-0000-7000-8000-00000000000d",
        {
          scroll: false,
        },
      ),
    );
    expect(requests).toEqual([
      {
        method: "POST",
        path: "/api/admin/roles",
        body: { name: "Ops", description: "", permissions: ["users:read"] },
      },
    ]);
  });

  it("asks for a name before calling the API", async () => {
    const editor = await open("new");

    await userEvent.click(within(editor).getByRole("button", { name: "Create role" }));

    expect(within(editor).getByLabelText("Name")).toHaveAccessibleDescription("Name is required");
    expect(requests).toEqual([]);
  });

  it("explains a name clash", async () => {
    server.use(
      http.post("/api/admin/roles", () =>
        HttpResponse.json(
          { error: { code: "ROLE_NAME_TAKEN", message: "taken" } },
          { status: 409 },
        ),
      ),
    );
    const editor = await open("new");

    await userEvent.type(within(editor).getByLabelText("Name"), "Member");
    await userEvent.click(within(editor).getByRole("button", { name: "Create role" }));

    expect(await within(editor).findByRole("alert")).toHaveTextContent(
      "Another role already has that name",
    );
  });

  it("locks what the admin role must keep and leaves it out of the change", async () => {
    const editor = await open(ADMIN_ROLE_ID);

    expect(within(editor).getByLabelText("Name")).toBeDisabled();
    expect(within(editor).getByRole("checkbox", { name: "users:manage" })).toBeDisabled();
    expect(within(editor).queryByRole("button", { name: /Delete/ })).toBeNull();

    await userEvent.click(within(editor).getByRole("button", { name: "Save changes" }));

    expect(await within(editor).findByRole("status")).toHaveTextContent("Saved.");
    expect(requests).toEqual([
      {
        method: "PATCH",
        path: `/api/admin/roles/${ADMIN_ROLE_ID}`,
        body: { description: "Full access" },
      },
    ]);
  });

  it("deletes an unused custom role after confirmation", async () => {
    const editor = await open(support.id);

    await userEvent.click(within(editor).getByRole("button", { name: "Delete role…" }));
    const confirm = within(editor).getByRole("group", { name: "Confirm deletion" });
    expect(confirm).toHaveTextContent("Delete Support desk?");
    await userEvent.click(within(confirm).getByRole("button", { name: "Delete role" }));

    await vi.waitFor(() =>
      expect(navigation.replace).toHaveBeenCalledWith("/admin/roles", { scroll: false }),
    );
    expect(requests).toEqual([
      { method: "DELETE", path: `/api/admin/roles/${support.id}`, body: undefined },
    ]);
  });

  it("explains why a role people hold cannot be deleted", async () => {
    roles = [...makeRoles(), { ...support, userCount: 2 }];
    const editor = await open(support.id);

    expect(editor).toHaveTextContent("first remove it from the 2 people who hold it");
    expect(within(editor).queryByRole("button", { name: /Delete/ })).toBeNull();
  });

  it("is read-only for people who can see roles but not manage them", async () => {
    server.use(
      http.get("/api/auth/me", () =>
        HttpResponse.json({ user: makeUser({ permissions: ["users:read"] }) }),
      ),
    );
    renderWithClient(<AdminRoles />);

    expect(await screen.findByRole("link", { name: "View Support desk" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "New role" })).toBeNull();
  });
});
