import { PrismaDatabaseProvider } from "../src/core/database/prisma.database.js";
import { Argon2PasswordHasher } from "../src/core/identity/argon2.password-hasher.js";
import { PinoLogger } from "../src/core/logger/pino.logger.js";
import { SEED_ACCOUNTS, SEED_PASSWORD } from "./seed/seed-data.js";
import { isLocalDatabaseUrl, seedDatabase } from "./seed/seed-database.js";

const databaseUrl = process.env["DATABASE_URL"];
if (!databaseUrl) {
  console.error("DATABASE_URL is not set. Put it in apps/api/.env or pass it in the environment.");
  process.exit(1);
}
if (!isLocalDatabaseUrl(databaseUrl)) {
  console.error(
    "Refusing to seed: the database is not local. The seed accounts have a published password and must never exist anywhere else.",
  );
  process.exit(1);
}

const database = new PrismaDatabaseProvider(databaseUrl, PinoLogger.create({ level: "silent" }));

try {
  const { accountsCreated, ticketsCreated } = await seedDatabase(
    database.client,
    new Argon2PasswordHasher(),
  );
  console.log(`Added ${accountsCreated} accounts and ${ticketsCreated} tickets.`);
  console.log(`\nSign in at http://localhost:3000/login with password "${SEED_PASSWORD}":`);
  for (const account of SEED_ACCOUNTS) {
    console.log(`  ${account.email.padEnd(22)} ${account.roles.join(", ")}, ${account.status}`);
  }
} finally {
  await database.disconnect();
}
