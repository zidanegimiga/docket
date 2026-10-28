/** What to tell the user for error codes that arrive in the login page's URL. */
const loginErrors: Record<string, string> = {
  ACCOUNT_DISABLED: "This account has been disabled. Contact an administrator.",
  OAUTH_ACCOUNT_EXISTS:
    "An account with this email already exists. Sign in with your password. Once your email is confirmed, Google will link to it.",
  OAUTH_EMAIL_UNVERIFIED: "Google did not confirm your email address, so we cannot use it.",
  OAUTH_CANCELLED: "Google sign-in was cancelled.",
  OAUTH_EXPIRED: "Sign-in took too long. Try again.",
  VERIFICATION_LINK_EXPIRED:
    "That confirmation link has expired. Sign in and we can send you a new one.",
  VERIFICATION_LINK_INVALID: "That confirmation link is not valid. It may have been replaced.",
};

export function loginErrorMessage(code: string | undefined): string | null {
  if (!code) return null;
  return loginErrors[code] ?? "Sign-in could not be completed. Try again.";
}

export function credentialErrorMessage(code: string): string {
  if (code === "INVALID_CREDENTIALS") return "Email or password is incorrect.";
  if (code === "ACCOUNT_DISABLED") return loginErrors["ACCOUNT_DISABLED"]!;
  if (code === "NETWORK_ERROR") return "Could not reach the server. Check your connection.";
  return "Sign-in failed. Try again.";
}
