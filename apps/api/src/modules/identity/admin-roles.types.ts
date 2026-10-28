import type { CreateRoleBody, Permission, UpdateRoleBody } from "@docket/contracts";

export interface AdminRoleRecord {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: string[];
  userCount: number;
}

export interface AdminRoleEntity extends Omit<AdminRoleRecord, "permissions"> {
  permissions: Permission[];
}

export type DeleteRoleOutcome = "deleted" | "not_found" | "refused";

export interface AdminRoleRepository {
  list(): Promise<AdminRoleRecord[]>;
  findById(id: string): Promise<AdminRoleRecord | null>;
  /** Null when another role already has the name, compared without case. */
  create(role: CreateRoleBody): Promise<AdminRoleRecord | null>;
  /** Null when another role already has the name, compared without case. */
  update(id: string, change: UpdateRoleBody): Promise<AdminRoleRecord | null>;
  /**
   * Deletes a custom role nobody holds, in one statement so an assignment made at the same moment
   * cannot be lost. "refused" when the role is built in or assigned.
   */
  delete(id: string): Promise<DeleteRoleOutcome>;
}
