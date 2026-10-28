import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { SignUpForm } from "@/features/auth/components/SignUpForm";

import { renderWithClient } from "../support/render";
import { server } from "../support/server";

describe("SignUpForm", () => {
  const fillIn = async (password: string) => {
    await userEvent.type(screen.getByLabelText("Name"), "Grace Hopper");
    await userEvent.type(screen.getByLabelText("Email"), "grace@example.com");
    await userEvent.type(screen.getByLabelText("Password"), password);
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
  };

  it("replaces the form with the API's next steps", async () => {
    server.use(
      http.post("/api/auth/signup", () =>
        HttpResponse.json({ message: "Thanks. Check your email." }, { status: 202 }),
      ),
    );

    renderWithClient(<SignUpForm />);
    await fillIn("violet harbour lantern");

    expect(await screen.findByRole("status")).toHaveTextContent("Thanks. Check your email.");
    expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
  });

  it("asks for a longer password without calling the API", async () => {
    renderWithClient(<SignUpForm />);
    await fillIn("short");

    expect(screen.getByLabelText("Password")).toHaveAccessibleDescription(
      "Use at least 12 characters",
    );
  });
});
