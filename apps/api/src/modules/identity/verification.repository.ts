import type { PrismaClient } from "../../generated/prisma/client.js";
import type {
  EmailVerificationOutcome,
  NewEmailVerificationToken,
  VerificationTokenRepository,
} from "./verification.types.js";

const EMAIL_VERIFICATION = "email_verification";

export class PrismaVerificationTokenRepository implements VerificationTokenRepository {
  constructor(private readonly db: PrismaClient) {}

  async issueEmailVerification({
    userId,
    tokenHash,
    expiresAt,
  }: NewEmailVerificationToken): Promise<void> {
    await this.db.$transaction([
      this.db.verificationToken.deleteMany({
        where: { userId, purpose: EMAIL_VERIFICATION, usedAt: null },
      }),
      this.db.verificationToken.create({
        data: { userId, purpose: EMAIL_VERIFICATION, tokenHash, expiresAt },
        select: { id: true },
      }),
    ]);
  }

  verifyEmail(tokenHash: string, at: Date): Promise<EmailVerificationOutcome> {
    return this.db.$transaction(async (tx) => {
      const token = await tx.verificationToken.findUnique({
        where: { tokenHash },
        select: { id: true, userId: true, purpose: true, expiresAt: true, usedAt: true },
      });

      if (!token || token.purpose !== EMAIL_VERIFICATION) return { status: "invalid" };
      if (token.usedAt) return { status: "verified", userId: token.userId };
      if (token.expiresAt <= at) return { status: "expired" };

      await tx.verificationToken.update({
        where: { id: token.id },
        data: { usedAt: at },
        select: { id: true },
      });
      await tx.user.updateMany({
        where: { id: token.userId, emailVerifiedAt: null },
        data: { emailVerifiedAt: at },
      });
      return { status: "verified", userId: token.userId };
    });
  }
}
