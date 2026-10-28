import { Prisma, type PrismaClient } from "../../generated/prisma/client.js";
import type {
  LinkedIdentity,
  NewExternalUser,
  NewPasswordUser,
  UserAccess,
  UserRecord,
  UserRepository,
} from "./user.types.js";

const UNIQUE_VIOLATION = "P2002";

const userColumns = {
  id: true,
  email: true,
  name: true,
  status: true,
  passwordHash: true,
  emailVerifiedAt: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === UNIQUE_VIOLATION;

export class PrismaUserRepository implements UserRepository {
  constructor(private readonly db: PrismaClient) {}

  findById(id: string): Promise<UserRecord | null> {
    return this.db.user.findUnique({ where: { id }, select: userColumns });
  }

  findByEmail(email: string): Promise<UserRecord | null> {
    return this.db.user.findUnique({ where: { email }, select: userColumns });
  }

  async findByIdentity(provider: string, subject: string): Promise<UserRecord | null> {
    const identity = await this.db.userIdentity.findUnique({
      where: { provider_subject: { provider, subject } },
      select: { user: { select: userColumns } },
    });
    return identity?.user ?? null;
  }

  async createWithPassword({
    email,
    name,
    passwordHash,
  }: NewPasswordUser): Promise<UserRecord | null> {
    try {
      return await this.db.user.create({
        data: { email, name, passwordHash },
        select: userColumns,
      });
    } catch (error) {
      if (isUniqueViolation(error)) return null;
      throw error;
    }
  }

  async createWithIdentity({
    email,
    name,
    emailVerified,
    identity,
  }: NewExternalUser): Promise<UserRecord | null> {
    try {
      return await this.db.user.create({
        data: {
          email,
          name,
          emailVerifiedAt: emailVerified ? new Date() : null,
          identities: { create: identity },
        },
        select: userColumns,
      });
    } catch (error) {
      if (isUniqueViolation(error)) return null;
      throw error;
    }
  }

  async linkIdentity(userId: string, identity: LinkedIdentity): Promise<void> {
    await this.db.userIdentity.create({ data: { userId, ...identity } });
  }

  async listProviders(userId: string): Promise<string[]> {
    const identities = await this.db.userIdentity.findMany({
      where: { userId },
      select: { provider: true },
      orderBy: { provider: "asc" },
    });
    return identities.map(({ provider }) => provider);
  }

  async findAccess(userId: string): Promise<UserAccess | null> {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: {
        status: true,
        roles: { select: { role: { select: { permissions: { select: { permission: true } } } } } },
        permissions: { select: { permission: true } },
      },
    });
    if (!user) return null;

    return {
      status: user.status,
      rolePermissions: user.roles.flatMap(({ role }) => role.permissions.map((p) => p.permission)),
      directPermissions: user.permissions.map(({ permission }) => permission),
    };
  }

  async recordLogin(userId: string, at: Date): Promise<void> {
    await this.db.user.update({
      where: { id: userId },
      data: { lastLoginAt: at },
      select: { id: true },
    });
  }

  async updatePasswordHash(userId: string, passwordHash: string): Promise<void> {
    await this.db.user.update({
      where: { id: userId },
      data: { passwordHash },
      select: { id: true },
    });
  }
}
