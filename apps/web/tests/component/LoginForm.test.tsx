import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { authKeys } from "@/features/auth/api/auth.queries";
import { LoginForm } from "@/features/auth/components/LoginForm";

import { makeUser } from "../support/fixtures";
import { renderWithClient } from "../support/render";
import { server } from "../support/server";

const router = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));

describe("LoginForm", () => {
  beforeEach(() => {
    router.replace.mockReset();
    router.refresh.mockReset();
  });

  const fillIn = async (email: string, password: string) => {
    await userEvent.type(screen.getByLabelText("Email"), email);
    await userEvent.type(screen.getByLabelText("Password"), password);
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
  };

  it("signs in, stores the user and goes back to the page they came from", async () => {
    let body: unknown;
    const user = makeUser();
    server.use(
      http.post("/api/auth/login", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ user });
      }),
    );

    const { client } = renderWithClient(<LoginForm returnTo="/?status=open" />);
    await fillIn("Ada@Example.com", "correct horse battery");

    await vi.waitFor(() => expect(router.replace).toHaveBeenCalledWith("/?status=open"));
    expect(body).toEqual({ email: "ada@example.com", password: "correct horse battery" });
    expect(client.getQueryData(authKeys.currentUser())).toEqual(user);
  });

  it("explains wrong credentials without leaving the page", async () => {
    server.use(
      http.post("/api/auth/login", () =>
        HttpResponse.json(
          { error: { code: "INVALID_CREDENTIALS", message: "Email or password is incorrect" } },
          { status: 401 },
        ),
      ),
    );

    renderWithClient(<LoginForm returnTo="/" />);
    await fillIn("ada@example.com", "wrong");

    expect(await screen.findByRole("alert")).toHaveTextContent("Email or password is incorrect.");
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("checks the fields before calling the API", async () => {
    renderWithClient(<LoginForm returnTo="/" />);
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(screen.getByLabelText("Email")).toHaveAccessibleDescription(
      "Enter a valid email address",
    );
    expect(screen.getByLabelText("Password")).toHaveAccessibleDescription("Password is required");
  });
});
