type SearchParams = Record<string, string | string[] | undefined>;

export const ROLES_PATH = "/admin/roles";
/** The `role` value that opens the editor for a new role. */
export const NEW_ROLE = "new";

/** The role open in the editor: an id, NEW_ROLE, or nothing. */
export function parseSelectedRole(params: SearchParams): string | undefined {
  const value = params["role"];
  return (Array.isArray(value) ? value[0] : value) || undefined;
}

export function roleHref(selected?: string): string {
  return selected ? `${ROLES_PATH}?role=${encodeURIComponent(selected)}` : ROLES_PATH;
}
