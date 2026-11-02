import { describe, expect, it } from "vitest";

import { isLocalDatabaseUrl } from "../../scripts/seed/seed-database.js";

describe("isLocalDatabaseUrl", () => {
  it.each([
    "postgresql://tickets:tickets@localhost:5432/tickets",
    "postgresql://tickets:tickets@127.0.0.1:5432/tickets",
    "postgresql://tickets:tickets@[::1]:5432/tickets",
    "postgresql://tickets:tickets@db:5432/tickets",
  ])("allows %s", (url) => {
    expect(isLocalDatabaseUrl(url)).toBe(true);
  });

  it.each([
    "postgresql://owner:secret@ep-example.eu-central-1.aws.neon.tech/neondb?sslmode=require",
    "postgresql://user:pass@localhost.evil.example:5432/db",
    "not a url",
  ])("refuses %s", (url) => {
    expect(isLocalDatabaseUrl(url)).toBe(false);
  });
});
