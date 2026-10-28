import { describe, expect, it } from "vitest";

import { loadEnv } from "../../src/core/config/env.js";

const base = { DATABASE_URL: "postgresql://user:pass@localhost:5432/db" };

describe("loadEnv", () => {
  it("applies development defaults", () => {
    expect(loadEnv(base)).toMatchObject({
      NODE_ENV: "development",
      WEB_ORIGIN: "http://localhost:3000",
      AUTH_ISSUER: "http://localhost:4000",
      AUTH_AUDIENCE: "docket-api",
      ACCESS_TOKEN_TTL_SECONDS: 600,
      REFRESH_TOKEN_TTL_DAYS: 30,
      AUTH_ALLOW_EPHEMERAL_KEY: false,
    });
  });

  it("requires a signing key in production unless a temporary one is explicitly allowed", () => {
    expect(() => loadEnv({ ...base, NODE_ENV: "production" })).toThrow(/AUTH_PRIVATE_KEY/);
    expect(() =>
      loadEnv({ ...base, NODE_ENV: "production", AUTH_ALLOW_EPHEMERAL_KEY: "true" }),
    ).not.toThrow();
    expect(() =>
      loadEnv({ ...base, NODE_ENV: "production", AUTH_PRIVATE_KEY: "{}" }),
    ).not.toThrow();
  });

  it("requires Google credentials as a pair and treats blank values as unset", () => {
    expect(() => loadEnv({ ...base, GOOGLE_CLIENT_ID: "id" })).toThrow(/GOOGLE_CLIENT_SECRET/);
    expect(loadEnv({ ...base, GOOGLE_CLIENT_ID: "", GOOGLE_CLIENT_SECRET: " " })).toMatchObject({
      GOOGLE_CLIENT_ID: undefined,
      GOOGLE_CLIENT_SECRET: undefined,
    });
  });

  it("reduces WEB_ORIGIN to its origin and only accepts http or https URLs", () => {
    expect(loadEnv({ ...base, WEB_ORIGIN: "https://app.example.com/path/" }).WEB_ORIGIN).toBe(
      "https://app.example.com",
    );
    expect(() => loadEnv({ ...base, WEB_ORIGIN: "localhost:3000" })).toThrow(/WEB_ORIGIN/);
    expect(() => loadEnv({ ...base, AUTH_ISSUER: "javascript:alert(1)" })).toThrow(/AUTH_ISSUER/);
  });

  it("keeps token lifetimes within sane bounds", () => {
    expect(() => loadEnv({ ...base, ACCESS_TOKEN_TTL_SECONDS: "86400" })).toThrow(
      /ACCESS_TOKEN_TTL_SECONDS/,
    );
    expect(() => loadEnv({ ...base, REFRESH_TOKEN_TTL_DAYS: "365" })).toThrow(
      /REFRESH_TOKEN_TTL_DAYS/,
    );
  });
});
