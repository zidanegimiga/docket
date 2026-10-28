import { createContainer, type Container } from "../../src/container.js";
import { loadEnv } from "../../src/core/config/env.js";
import { generateSigningKeyJwk } from "../../src/core/identity/signing-key.js";

export const TEST_DATABASE_URL =
  process.env["TEST_DATABASE_URL"] ?? "postgresql://tickets:tickets@localhost:5432/docket_test";

const testSigningKey = await generateSigningKeyJwk();

export function createTestContainer(): Promise<Container> {
  return createContainer(
    loadEnv({
      NODE_ENV: "test",
      LOG_LEVEL: "silent",
      DATABASE_URL: TEST_DATABASE_URL,
      AUTH_PRIVATE_KEY: testSigningKey,
    }),
  );
}

export async function resetDatabase({ database }: Container): Promise<void> {
  await database.client.$executeRaw`TRUNCATE TABLE "tickets", "users" RESTART IDENTITY CASCADE`;
  await database.client.role.deleteMany({ where: { isSystem: false } });
}
