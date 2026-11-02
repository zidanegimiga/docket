import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TextField } from "@/shared/components/TextField";

describe("TextField", () => {
  it("links the label, hint and input", () => {
    render(<TextField name="title" label="Title" hint="Short and specific" />);

    expect(screen.getByLabelText("Title")).toHaveAccessibleDescription("Short and specific");
  });

  it("puts adornments inside the field without changing how the input is found", () => {
    render(
      <TextField
        name="budget"
        label="Budget"
        start="KES"
        end={<button type="button">Clear</button>}
      />,
    );

    const input = screen.getByLabelText("Budget");
    const group = input.parentElement!;
    expect(group).toHaveTextContent("KES");
    expect(group).toContainElement(screen.getByRole("button", { name: "Clear" }));
  });

  it("renders a plain input when there are no adornments", () => {
    render(<TextField name="title" label="Title" />);

    expect(screen.getByLabelText("Title").parentElement?.tagName).toBe("DIV");
    expect(screen.getByLabelText("Title").parentElement).toContainElement(
      screen.getByText("Title"),
    );
  });
});
