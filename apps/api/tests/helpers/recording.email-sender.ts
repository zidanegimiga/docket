import type { EmailMessage, EmailSender } from "../../src/core/email/email-sender.interface.js";

export class RecordingEmailSender implements EmailSender {
  readonly sent: EmailMessage[] = [];
  failWith: Error | undefined;

  async send(message: EmailMessage): Promise<void> {
    if (this.failWith) throw this.failWith;
    this.sent.push(message);
  }
}
