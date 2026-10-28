import { randomUUID } from "node:crypto";

import type {
  LinkedIdentity,
  NewExternalUser,
  NewPasswordUser,
  UserAccess,
  UserRecord,
  UserRepository,
} from "../../src/modules/identity/user.types.js";

interface StoredIdentity extends LinkedIdentity {
  userId: string;
}

export class InMemoryUserRepository implements UserRepository {
  readonly users: UserRecord[] = [];
  readonly identities: StoredIdentity[] = [];
  private readonly access = new Map<string, Omit<UserAccess, "status">>();

  grant(userId: string, access: Partial<Omit<UserAccess, "status">>): void {
    this.access.set(userId, { rolePermissions: [], directPermissions: [], ...access });
  }

  async findById(id: string): Promise<UserRecord | null> {
    return this.users.find((user) => user.id === id) ?? null;
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    return this.users.find((user) => user.email === email) ?? null;
  }

  async findByIdentity(provider: string, subject: string): Promise<UserRecord | null> {
    const identity = this.identities.find((i) => i.provider === provider && i.subject === subject);
    return identity ? this.findById(identity.userId) : null;
  }

  async createWithPassword({
    email,
    name,
    passwordHash,
  }: NewPasswordUser): Promise<UserRecord | null> {
    if (await this.findByEmail(email)) return null;
    return this.insert({ email, name, passwordHash, emailVerifiedAt: null });
  }

  async createWithIdentity({ email, name, emailVerified, identity }: NewExternalUser) {
    if (await this.findByEmail(email)) return null;
    if (await this.findByIdentity(identity.provider, identity.subject)) return null;
    const user = this.insert({
      email,
      name,
      passwordHash: null,
      emailVerifiedAt: emailVerified ? new Date() : null,
    });
    this.identities.push({ ...identity, userId: user.id });
    return user;
  }

  async linkIdentity(userId: string, identity: LinkedIdentity): Promise<void> {
    this.identities.push({ ...identity, userId });
  }

  async listProviders(userId: string): Promise<string[]> {
    return this.identities
      .filter((identity) => identity.userId === userId)
      .map((identity) => identity.provider)
      .sort();
  }

  async findAccess(userId: string): Promise<UserAccess | null> {
    const user = await this.findById(userId);
    if (!user) return null;
    return {
      status: user.status,
      ...(this.access.get(userId) ?? { rolePermissions: [], directPermissions: [] }),
    };
  }

  async recordLogin(userId: string, at: Date): Promise<void> {
    const user = await this.findById(userId);
    if (user) user.lastLoginAt = at;
  }

  async updatePasswordHash(userId: string, passwordHash: string): Promise<void> {
    const user = await this.findById(userId);
    if (user) user.passwordHash = passwordHash;
  }

  private insert(fields: Pick<UserRecord, "email" | "name" | "passwordHash" | "emailVerifiedAt">) {
    const now = new Date();
    const user: UserRecord = {
      id: randomUUID(),
      status: "pending",
      lastLoginAt: null,
      createdAt: now,
      updatedAt: now,
      ...fields,
    };
    this.users.push(user);
    return user;
  }
}
