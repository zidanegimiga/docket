import { describe, expect, it } from "vitest";

import { loggableUrl } from "../../src/shared/middleware/request-logger.middleware.js";

describe("loggableUrl", () => {
  it("leaves URLs without credentials untouched", () => {
    expect(loggableUrl("/tickets?status=open&page=2")).toBe("/tickets?status=open&page=2");
    expect(loggableUrl("/health")).toBe("/health");
  });

  it.each([
    ["/auth/verify-email?token=s3cret", "/auth/verify-email?token=%5Bredacted%5D"],
    [
      "/auth/oauth/google/callback?code=abc&state=xyz&scope=openid",
      "/auth/oauth/google/callback?code=%5Bredacted%5D&state=%5Bredacted%5D&scope=openid",
    ],
    ["/x?TOKEN=a&token=b", "/x?TOKEN=%5Bredacted%5D&token=%5Bredacted%5D"],
  ])("redacts credentials in %s", (url, expected) => {
    expect(loggableUrl(url)).toBe(expected);
    expect(loggableUrl(url)).not.toMatch(/s3cret|abc|xyz|=a&|=b$/);
  });
});
