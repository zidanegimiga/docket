import { describe, expect, it } from "vitest";

import { listHref, parseListQuery } from "@/features/tickets/list-query";

describe("parseListQuery", () => {
  it("applies defaults when the URL has no params", () => {
    expect(parseListQuery({})).toEqual({ page: 1, limit: 20 });
  });

  it("coerces valid params from strings", () => {
    expect(parseListQuery({ status: "closed", page: "3", limit: "50" })).toEqual({
      status: "closed",
      page: 3,
      limit: 50,
    });
  });

  it("uses the first value when a param is repeated", () => {
    expect(parseListQuery({ status: ["open", "closed"] })).toEqual({
      status: "open",
      page: 1,
      limit: 20,
    });
  });

  it("falls back to defaults when any param is invalid", () => {
    expect(parseListQuery({ status: "bogus", page: "-4" })).toEqual({ page: 1, limit: 20 });
  });
});

describe("listHref", () => {
  it("omits default values so the plain list is the root path", () => {
    expect(listHref({ page: 1, limit: 20 })).toBe("/");
  });

  it("includes status, page and a non-default limit", () => {
    expect(listHref({ status: "in_progress", page: 2, limit: 50 })).toBe(
      "/?status=in_progress&page=2&limit=50",
    );
  });
});
