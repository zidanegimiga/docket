import type { CreateRoleBody, Permission, UpdateRoleBody } from "@docket/contracts";

import type { NewAuditEvent } from "./audit.types.js";

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
  /**
   * Null when another role already has the name, compared without case. `describe` builds the
   * audit entries for the created role, recorded in the same transaction.
   */
  create(
    role: CreateRoleBody,
    describe: (created: AdminRoleRecord) => NewAuditEvent[],
  ): Promise<AdminRoleRecord | null>;
  /** Null when another role already has the name. The audit entries commit with the change. */
  update(
    id: string,
    change: UpdateRoleBody,
    audit: NewAuditEvent[],
  ): Promise<AdminRoleRecord | null>;
  /**
   * Deletes a custom role nobody holds, in one statement so an assignment made at the same moment
   * cannot be lost. "refused" when the role is built in or assigned.
   */
  delete(id: string, audit: NewAuditEvent[]): Promise<DeleteRoleOutcome>;
}
