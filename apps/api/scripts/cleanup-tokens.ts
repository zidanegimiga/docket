import { PrismaDatabaseProvider } from "../src/core/database/prisma.database.js";
import { PinoLogger } from "../src/core/logger/pino.logger.js";
import { LoggerMonitor } from "../src/core/monitoring/logger.monitor.js";
import { createIdentityJobs } from "../src/modules/identity/index.js";

// For running cleanup by hand or from an external scheduler. The API also runs it on its own
// every TOKEN_CLEANUP_INTERVAL_MINUTES.
const databaseUrl = process.env["DATABASE_URL"];
if (!databaseUrl) {
  console.error("DATABASE_URL is not set. Put it in apps/api/.env or pass it in the environment.");
  process.exit(1);
}

const logger = PinoLogger.create({ level: "warn" });
const database = new PrismaDatabaseProvider(databaseUrl, logger);

try {
  const { refreshTokens, verificationTokens } = await createIdentityJobs({
    database,
    logger,
    monitor: new LoggerMonitor(logger),
  }).cleanupTokens();
  console.log(
    `Deleted ${refreshTokens} refresh tokens and ${verificationTokens} verification tokens that expired over a day ago.`,
  );
} finally {
  await database.disconnect();
}
