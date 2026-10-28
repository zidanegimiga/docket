import { describe, expect, it } from "vitest";

import { parseUserListView, userListHref } from "@/features/admin/user-query";

describe("user list URL state", () => {
  it("round-trips a view through the URL", () => {
    const view = parseUserListView({
      status: "pending",
      search: "grace",
      page: "2",
      user: "0199c3a2-6f1e-7c3a-9b1d-2f4e6a8c0d02",
    });

    expect(view).toEqual({
      status: "pending",
      search: "grace",
      page: 2,
      limit: 20,
      selected: "0199c3a2-6f1e-7c3a-9b1d-2f4e6a8c0d02",
    });
    expect(userListHref(view)).toBe(
      "/admin/users?status=pending&search=grace&page=2&user=0199c3a2-6f1e-7c3a-9b1d-2f4e6a8c0d02",
    );
  });

  it("falls back to the default list for invalid values but keeps the selection", () => {
    expect(parseUserListView({ status: "archived", page: "-1", user: "abc" })).toEqual({
      page: 1,
      limit: 20,
      selected: "abc",
    });
  });

  it("treats an empty search as no search", () => {
    expect(parseUserListView({ search: "" })).not.toHaveProperty("search", "");
    expect(userListHref({})).toBe("/admin/users");
  });
});
