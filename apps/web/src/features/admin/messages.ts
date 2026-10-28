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
