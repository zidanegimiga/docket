import { parseArgs } from "node:util";

import { emailSchema } from "@docket/contracts";

import { PrismaDatabaseProvider } from "../src/core/database/prisma.database.js";
import { PinoLogger } from "../src/core/logger/pino.logger.js";
import { promoteToAdmin } from "../src/modules/identity/admin-promotion.js";

const usage = "Usage: npm run admin:promote -w @docket/api -- --email you@example.com";

const { values } = parseArgs({ options: { email: { type: "string" } } });
const email = emailSchema.safeParse(values.email);
if (!email.success) {
  console.error(`A valid --email is required.\n${usage}`);
  process.exit(1);
}

const databaseUrl = process.env["DATABASE_URL"];
if (!databaseUrl) {
  console.error("DATABASE_URL is not set. Put it in apps/api/.env or pass it in the environment.");
  process.exit(1);
}

const database = new PrismaDatabaseProvider(databaseUrl, PinoLogger.create({ level: "silent" }));

try {
  const result = await promoteToAdmin(database.client, email.data);

  if (!result.promoted) {
    console.error(
      `No account uses ${email.data}. Sign up in the app first (with a password or Google), then run this again.`,
    );
    process.exitCode = 1;
  } else if (result.alreadyAdmin && result.previousStatus === "active") {
    console.log(`${email.data} is already an active administrator. Nothing changed.`);
  } else {
    console.log(`${email.data} is now an active administrator (was ${result.previousStatus}).`);
    console.log("Sign out and in again, or wait up to ten minutes, for the new access to apply.");
  }
} finally {
  await database.disconnect();
}
