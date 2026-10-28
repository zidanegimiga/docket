import type { Permission } from "@docket/contracts";
import { screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";

import { MainNav } from "@/app/(app)/_components/MainNav";

import { makeUser } from "../support/fixtures";
import { renderWithClient } from "../support/render";
import { server } from "../support/server";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin/users" }));

const signedInWith = (permissions: Permission[]) =>
  server.use(
    http.get("/api/auth/me", () => HttpResponse.json({ user: makeUser({ permissions }) })),
  );

describe("MainNav", () => {
  it("shows each section the user can use and marks the current one", async () => {
    signedInWith(["tickets:read", "users:read"]);
    renderWithClient(<MainNav />);

    expect(await screen.findByRole("link", { name: "Users" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Tickets" })).not.toHaveAttribute("aria-current");
  });

  it("stays out of the way when there is only one section", async () => {
    signedInWith(["tickets:read"]);
    renderWithClient(<MainNav />);

    await vi.waitFor(() => expect(screen.queryByRole("navigation")).toBeNull());
    expect(screen.queryByRole("link", { name: "Users" })).toBeNull();
  });
});
