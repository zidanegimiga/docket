export interface NewEmailVerificationToken {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}

export type EmailVerificationOutcome =
  { status: "verified"; userId: string } | { status: "expired" } | { status: "invalid" };

export interface VerificationTokenRepository {
  /** Stores a new email verification token and discards the user's earlier unused ones. */
  issueEmailVerification(token: NewEmailVerificationToken): Promise<void>;
  /**
   * Uses the token and marks the user's email verified, atomically. A token that was already
   * used still reports success, so a second click or a mail scanner's prefetch is harmless.
   */
  verifyEmail(tokenHash: string, at: Date): Promise<EmailVerificationOutcome>;
}
