import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { SessionGate } from "@/features/auth/components/SessionGate";

import { makeUser } from "../support/fixtures";
import { renderWithClient } from "../support/render";
import { server } from "../support/server";

describe("SessionGate", () => {
  it("shows the app with the user's name once they are known", async () => {
    renderWithClient(<SessionGate>Ticket list</SessionGate>);

    expect(await screen.findByText("Ticket list")).toBeInTheDocument();
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });

  it("holds a pending user at the waiting screen until an administrator approves them", async () => {
    const pending = makeUser({ status: "pending", permissions: [] });
    let approved = false;
    server.use(
      http.get("/api/auth/me", () => HttpResponse.json({ user: pending })),
      http.post("/api/auth/refresh", () =>
        HttpResponse.json({
          user: approved ? makeUser() : pending,
        }),
      ),
    );

    renderWithClient(<SessionGate>Ticket list</SessionGate>);
    expect(
      await screen.findByRole("heading", { name: "Waiting for approval" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Ticket list")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Check again" }));
    expect(await screen.findByText("Not approved yet.")).toBeInTheDocument();

    approved = true;
    await userEvent.click(screen.getByRole("button", { name: "Check again" }));
    expect(await screen.findByText("Ticket list")).toBeInTheDocument();
  });
});
