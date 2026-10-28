import type { Logger } from "../logger/logger.interface.js";
import type { EmailMessage, EmailSender } from "./email-sender.interface.js";

// Development stand-in for a real provider: the message, including any links, is written to the
// log instead of being delivered. Links in emails are credentials, so never use this in production.
export class LoggerEmailSender implements EmailSender {
  constructor(private readonly logger: Logger) {}

  async send({ to, subject, text }: EmailMessage): Promise<void> {
    this.logger.info("Email not delivered, logged instead", { email: { to, subject, text } });
  }
}
