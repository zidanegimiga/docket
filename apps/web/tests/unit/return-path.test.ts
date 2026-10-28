import { describe, expect, it } from "vitest";

import { safeReturnPath } from "@/features/auth/return-path";

describe("safeReturnPath", () => {
  it.each(["/", "/?status=open", "/admin/users?page=2#top"])("keeps %s", (path) => {
    expect(safeReturnPath(path)).toBe(path);
  });

  it.each([
    "//evil.example/path",
    "https://evil.example",
    "/\\evil.example",
    "javascript:alert(1)",
    "tickets",
    undefined,
    ["/"],
  ])("replaces %s with /", (value) => {
    expect(safeReturnPath(value)).toBe("/");
  });
});
