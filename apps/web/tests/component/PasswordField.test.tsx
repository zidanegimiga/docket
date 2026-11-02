import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { PasswordField } from "@/shared/components/PasswordField";

describe("PasswordField", () => {
  it("starts hidden and lets the user show and hide what they typed", async () => {
    render(<PasswordField name="password" label="Password" autoComplete="current-password" />);
    const input = screen.getByLabelText("Password");
    await userEvent.type(input, "violet harbour");

    expect(input).toHaveAttribute("type", "password");
    await userEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(input).toHaveAttribute("type", "text");
    expect(input).toHaveValue("violet harbour");

    await userEvent.click(screen.getByRole("button", { name: "Hide password" }));
    expect(input).toHaveAttribute("type", "password");
  });

  it("keeps the toggle from submitting the form and points it at the input", async () => {
    let submitted = false;
    render(
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submitted = true;
        }}
      >
        <PasswordField name="password" label="Password" id="secret" />
      </form>,
    );

    const toggle = screen.getByRole("button", { name: "Show password" });
    await userEvent.click(toggle);

    expect(submitted).toBe(false);
    expect(toggle).toHaveAttribute("aria-controls", "secret");
    expect(toggle).toHaveTextContent("Hide");
  });

  it("is never spell-checked, even while shown", async () => {
    render(<PasswordField name="password" label="Password" />);
    await userEvent.click(screen.getByRole("button", { name: "Show password" }));

    expect(screen.getByLabelText("Password")).toHaveAttribute("spellcheck", "false");
  });

  it("shows errors like any other field", () => {
    render(<PasswordField name="password" label="Password" error="Use at least 12 characters" />);

    const input = screen.getByLabelText("Password");
    expect(input).toBeInvalid();
    expect(input).toHaveAccessibleDescription("Use at least 12 characters");
  });
});
