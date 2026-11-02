import type { PasswordHasher } from "../../src/core/identity/password-hasher.interface.js";
import type { PrismaClient } from "../../src/generated/prisma/client.js";
import { SEED_ACCOUNTS, SEED_PASSWORD, SEED_TICKETS } from "./seed-data.js";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]", "db", "postgres"]);
const HOUR_MS = 60 * 60 * 1000;

/** True for databases on this machine or in Docker Compose, the only places the seed may run. */
export function isLocalDatabaseUrl(url: string): boolean {
  try {
    return LOCAL_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

export interface SeedResult {
  accountsCreated: number;
  ticketsCreated: number;
}

/**
 * Adds the seed accounts and tickets that are missing. Accounts are matched by email and tickets
 * by title, and existing rows are never changed, so running it twice adds nothing the second time.
 */
export async function seedDatabase(
  db: PrismaClient,
  hasher: PasswordHasher,
  now = new Date(),
): Promise<SeedResult> {
  let accountsCreated = 0;
  const passwordHash = await hasher.hash(SEED_PASSWORD);

  for (const account of SEED_ACCOUNTS) {
    const existing = await db.user.findUnique({
      where: { email: account.email },
      select: { id: true },
    });
    if (existing) continue;

    await db.user.create({
      data: {
        email: account.email,
        name: account.name,
        status: account.status,
        passwordHash,
        emailVerifiedAt: now,
        roles: { create: account.roles.map((name) => ({ role: { connect: { name } } })) },
      },
      select: { id: true },
    });
    accountsCreated += 1;
  }

  const creators = new Map(
    (
      await db.user.findMany({
        where: { email: { in: SEED_ACCOUNTS.map((account) => account.email) } },
        select: { id: true, email: true },
      })
    ).map((user) => [user.email, user.id]),
  );
  const existingTitles = new Set(
    (
      await db.ticket.findMany({
        where: { title: { in: SEED_TICKETS.map((ticket) => ticket.title) } },
        select: { title: true },
      })
    ).map((ticket) => ticket.title),
  );

  const missing = SEED_TICKETS.filter((ticket) => !existingTitles.has(ticket.title))
    // Oldest first, so ids rise with age as they would in real use.
    .sort((a, b) => b.hoursAgo - a.hoursAgo);
  const { count: ticketsCreated } = await db.ticket.createMany({
    data: missing.map(({ title, description, status, priority, hoursAgo, createdBy }) => {
      const createdAt = new Date(now.getTime() - hoursAgo * HOUR_MS);
      // Tickets that moved on were last touched some hours after they were opened.
      const updatedAt =
        status === "open"
          ? createdAt
          : new Date(createdAt.getTime() + Math.min(hoursAgo / 3, 48) * HOUR_MS);
      return {
        title,
        description,
        status,
        priority,
        createdAt,
        updatedAt,
        createdById: creators.get(createdBy) ?? null,
      };
    }),
  });

  return { accountsCreated, ticketsCreated };
}
