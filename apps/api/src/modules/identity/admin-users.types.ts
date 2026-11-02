import type { ListUsersQuery, Permission, UpdateUserBody, UserStatus } from "@docket/contracts";

import type { NewAuditEvent } from "./audit.types.js";

/** A user as administrators see them. Never carries the password hash itself. */
export interface AdminUserRecord {
  id: string;
  email: string;
  name: string;
  status: UserStatus;
  hasPassword: boolean;
  createdAt: Date;
  lastLoginAt: Date | null;
  roles: { id: string; name: string; permissions: string[] }[];
  directPermissions: string[];
  providers: string[];
}

export interface AdminUserEntity {
  id: string;
  email: string;
  name: string;
  status: UserStatus;
  roles: { id: string; name: string }[];
  directPermissions: Permission[];
  effectivePermissions: Permission[];
  providers: string[];
  hasPassword: boolean;
  createdAt: Date;
  lastLoginAt: Date | null;
}

export type AdminRole = AdminUserRecord["roles"][number];

/** Everything a rule needs to judge an access change before it is written. */
export interface AccessChangeSnapshot {
  before: Pick<AdminUserRecord, "id" | "email" | "status" | "roles" | "directPermissions">;
  after: { status: UserStatus; roles: AdminRole[]; directPermissions: string[] };
  /** Requested role ids that do not exist. */
  unknownRoleIds: string[];
  /** Active users other than this one who hold the admin role. */
  otherActiveAdmins: number;
}

export interface AdminUserRepository {
  list(query: ListUsersQuery): Promise<{ items: AdminUserRecord[]; total: number }>;
  /**
   * Applies an access change atomically. `decide` sees the state before and after, throws to
   * refuse, and returns the audit entries to record with the change; changes to administrators are
   * serialised so concurrent edits cannot both pass it. Disabling a user revokes their refresh
   * tokens in the same transaction. Null if no such user.
   */
  updateAccess(
    id: string,
    change: UpdateUserBody,
    decide: (snapshot: AccessChangeSnapshot) => NewAuditEvent[],
  ): Promise<AdminUserRecord | null>;
}
