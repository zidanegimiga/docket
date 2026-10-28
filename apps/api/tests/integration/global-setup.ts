import { execFileSync } from "node:child_process";

import { PrismaPg } from "@prisma/adapter-pg";
import type { TestProject } from "vitest/node";

import { PrismaClient } from "../../src/generated/prisma/client.js";
import { TEST_DATABASE_URL } from "../helpers/test-app.js";

declare module "vitest" {
  export interface ProvidedContext {
    /** Built-in role name to permissions, as the migrations created them. */
    systemRoleGrants: Record<string, string[]>;
  }
}

export default async function setup(project: TestProject): Promise<void> {
  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: "pipe",
  });

  // Recorded before any test runs, so resetDatabase can undo tests that edit built-in roles while
  // system-roles.test.ts still checks what the migrations themselves granted.
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: TEST_DATABASE_URL }) });
  try {
    const roles = await db.role.findMany({
      where: { isSystem: true },
      select: { name: true, permissions: { select: { permission: true } } },
    });
    project.provide(
      "systemRoleGrants",
      Object.fromEntries(
        roles.map((role) => [role.name, role.permissions.map(({ permission }) => permission)]),
      ),
    );
  } finally {
    await db.$disconnect();
  }
}
