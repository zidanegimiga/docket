import type { UserStatus } from "@docket/contracts";

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  status: UserStatus;
  passwordHash: string | null;
  emailVerifiedAt: Date | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface LinkedIdentity {
  provider: string;
  subject: string;
  email: string | null;
}

export interface NewPasswordUser {
  email: string;
  name: string;
  passwordHash: string;
}

export interface NewExternalUser {
  email: string;
  name: string;
  emailVerified: boolean;
  identity: LinkedIdentity;
}

export interface UserAccess {
  status: UserStatus;
  rolePermissions: string[];
  directPermissions: string[];
}

export interface UserRepository {
  findById(id: string): Promise<UserRecord | null>;
  findByEmail(email: string): Promise<UserRecord | null>;
  findByIdentity(provider: string, subject: string): Promise<UserRecord | null>;
  /** Returns null when the email is already registered. */
  createWithPassword(user: NewPasswordUser): Promise<UserRecord | null>;
  /** Returns null when the email or the identity is already registered. */
  createWithIdentity(user: NewExternalUser): Promise<UserRecord | null>;
  linkIdentity(userId: string, identity: LinkedIdentity): Promise<void>;
  listProviders(userId: string): Promise<string[]>;
  findAccess(userId: string): Promise<UserAccess | null>;
  recordLogin(userId: string, at: Date): Promise<void>;
  updatePasswordHash(userId: string, passwordHash: string): Promise<void>;
}
