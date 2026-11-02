import type { Role } from "@docket/contracts";

/**
 * Mirrors the API's rules for built-in roles so the editor only offers what would be accepted:
 * built-in roles keep their names and stay, and admin always holds every permission.
 */
export const canRename = (role: Role) => !role.isSystem;
export const canChangePermissions = (role: Role) => role.name !== "admin";
export const canDelete = (role: Role) => !role.isSystem && role.userCount === 0;
