import { ApiError } from "@/shared/api/api-error";

/** What to tell an administrator when a change to a user is refused. */
export function updateUserErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return "The change could not be saved. Try again.";

  switch (error.code) {
    case "LAST_ADMIN":
      return "At least one active administrator must remain. Make someone else an administrator first.";
    case "CANNOT_CHANGE_OWN_ACCESS":
      return "You cannot disable your own account or remove your own permission to manage users.";
    case "VALIDATION_FAILED":
      return "Some of the roles or permissions no longer exist. Reload the page and try again.";
    case "NOT_FOUND":
      return "This user no longer exists.";
    case "PERMISSION_DENIED":
      return "You do not have permission to change users.";
    case "NETWORK_ERROR":
      return "Could not reach the server. Check your connection.";
    default:
      return "The change could not be saved. Try again.";
  }
}

/** What to tell an administrator when a role change is refused. */
export function roleErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return "The role could not be saved. Try again.";

  switch (error.code) {
    case "ROLE_NAME_TAKEN":
      return "Another role already has that name. Names are compared without case.";
    case "SYSTEM_ROLE":
    case "ROLE_IN_USE":
      // The API's message says exactly which rule applies and, for roles in use, to how many people.
      return error.message;
    case "NOT_FOUND":
      return "This role no longer exists.";
    case "PERMISSION_DENIED":
      return "You do not have permission to manage roles.";
    case "NETWORK_ERROR":
      return "Could not reach the server. Check your connection.";
    default:
      return "The role could not be saved. Try again.";
  }
}
