import { describe, expect, it } from "vitest";

import { sessionCookies } from "../../src/modules/identity/session-cookies.js";

const tokens = {
  accessToken: "a",
  accessTokenExpiresAt: new Date("2026-10-28T10:10:00Z"),
  refreshToken: "r",
  refreshTokenExpiresAt: new Date("2026-11-27T10:00:00Z"),
};

describe("sessionCookies", () => {
  it("uses __Host- and __Secure- prefixed, Secure cookies over HTTPS behind the /api prefix", () => {
    const [access, refresh, hint] = sessionCookies(tokens, { secure: true, apiPrefix: "/api" });

    expect(access).toMatchObject({
      name: "__Host-docket_access",
      options: { secure: true, httpOnly: true, sameSite: "lax", path: "/" },
    });
    expect(access?.options).not.toHaveProperty("domain");
    expect(refresh).toMatchObject({
      name: "__Secure-docket_refresh",
      options: { secure: true, httpOnly: true, sameSite: "lax", path: "/api/auth" },
    });
    expect(hint).toMatchObject({
      name: "__Host-docket_session",
      value: "1",
      options: { secure: true, httpOnly: false, path: "/", expires: tokens.refreshTokenExpiresAt },
    });
  });

  it("uses plain names without Secure for local HTTP", () => {
    const [access, refresh] = sessionCookies(tokens, { secure: false, apiPrefix: "/api" });

    expect(access).toMatchObject({ name: "docket_access", options: { secure: false } });
    expect(refresh).toMatchObject({ name: "docket_refresh", options: { path: "/api/auth" } });
  });
});
