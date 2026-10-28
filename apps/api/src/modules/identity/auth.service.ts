import type { SignUpBody } from "@docket/contracts";

import type { EmailMessage, EmailSender } from "../../core/email/email-sender.interface.js";
import type { PasswordHasher } from "../../core/identity/password-hasher.interface.js";
import type { Monitor } from "../../core/monitoring/monitor.interface.js";
import type { UserRepository } from "./user.types.js";

export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly emailSender: EmailSender,
    private readonly monitor: Monitor,
  ) {}

  async signUp({ email, name, password }: SignUpBody): Promise<void> {
    // Hash before checking for an existing account so both outcomes take the same time.
    const passwordHash = await this.passwordHasher.hash(password);
    const user = await this.users.createWithPassword({ email, name, passwordHash });

    if (user) {
      this.monitor.recordMetric("auth.signups", 1);
      await this.sendQuietly({
        to: email,
        subject: "Your Docket account is waiting for approval",
        text: `Hi ${name},\n\nThanks for signing up. An administrator needs to approve your account before you can use Docket. You will be able to sign in once that happens.`,
      });
    } else {
      await this.sendQuietly({
        to: email,
        subject: "Someone tried to sign up with your email",
        text: "Someone tried to create a Docket account with this email address, which already has one. If it was you, sign in instead. If not, you can ignore this email.",
      });
    }
  }

  private async sendQuietly(message: EmailMessage): Promise<void> {
    try {
      await this.emailSender.send(message);
    } catch (error) {
      this.monitor.captureException(error, { context: "auth.email", subject: message.subject });
    }
  }
}
