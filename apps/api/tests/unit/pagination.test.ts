import { describe, expect, it } from "vitest";

import { paginate } from "../../src/shared/http/pagination.js";

describe("paginate", () => {
  it.each([
    { total: 0, limit: 20, totalPages: 0 },
    { total: 1, limit: 20, totalPages: 1 },
    { total: 40, limit: 20, totalPages: 2 },
    { total: 41, limit: 20, totalPages: 3 },
  ])("total=$total, limit=$limit gives totalPages=$totalPages", ({ total, limit, totalPages }) => {
    expect(paginate([], total, { page: 1, limit }).pagination).toEqual({
      page: 1,
      limit,
      total,
      totalPages,
    });
  });

  it("echoes a page past the end without clamping it", () => {
    expect(paginate([], 5, { page: 4, limit: 2 }).pagination).toEqual({
      page: 4,
      limit: 2,
      total: 5,
      totalPages: 3,
    });
  });
});
