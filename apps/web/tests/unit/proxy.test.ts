import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { proxy } from "@/proxy";

const visit = (path: string, cookie?: string) =>
  proxy(new NextRequest(`http://localhost:3000${path}`, cookie ? { headers: { cookie } } : {}));

const location = (response: Response) => response.headers.get("location");

describe("proxy", () => {
  it("sends a visitor without a session to log in, remembering the page", () => {
    expect(location(visit("/?status=open"))).toBe(
      "http://localhost:3000/login?returnTo=%2F%3Fstatus%3Dopen",
    );
    expect(location(visit("/"))).toBe("http://localhost:3000/login");
  });

  it.each([
    ["a live access token", "docket_access=token"],
    ["only the session hint, so the browser can refresh", "docket_session=1"],
    ["the HTTPS cookie names", "__Host-docket_session=1"],
  ])("lets a visitor with %s through", (_, cookie) => {
    expect(location(visit("/", cookie))).toBeNull();
  });

  it("shows login and sign-up to visitors without an access token", () => {
    expect(location(visit("/login"))).toBeNull();
    expect(location(visit("/signup", "docket_session=1"))).toBeNull();
  });

  it("sends a signed-in visitor away from login", () => {
    expect(location(visit("/login", "docket_access=token"))).toBe("http://localhost:3000/");
  });
});
