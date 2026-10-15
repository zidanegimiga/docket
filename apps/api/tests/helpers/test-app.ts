import { createContainer, type Container } from "../../src/container.js";
import { loadEnv } from "../../src/core/config/env.js";

export const TEST_DATABASE_URL =
  process.env["TEST_DATABASE_URL"] ?? "postgresql://tickets:tickets@localhost:5432/docket_test";

export function createTestContainer(): Container {
  return createContainer(
    loadEnv({ NODE_ENV: "test", LOG_LEVEL: "silent", DATABASE_URL: TEST_DATABASE_URL }),
  );
}

export async function resetDatabase({ database }: Container): Promise<void> {
  await database.client.$executeRaw`TRUNCATE TABLE "tickets" RESTART IDENTITY`;
}
