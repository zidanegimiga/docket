import type { ListUsersQuery, Permission, UserStatus } from "@docket/contracts";

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

export interface AdminUserRepository {
  list(query: ListUsersQuery): Promise<{ items: AdminUserRecord[]; total: number }>;
}
