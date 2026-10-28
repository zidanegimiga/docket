import { describe, expect, it } from "vitest";

import { LoggerEmailSender } from "../../src/core/email/logger.email-sender.js";
import { RecordingLogger } from "../helpers/recording.logger.js";

describe("LoggerEmailSender", () => {
  it("writes the whole message to the log so links can be followed in development", async () => {
    const logger = new RecordingLogger();
    const message = {
      to: "jane@example.com",
      subject: "Verify your email",
      text: "Open http://localhost:3000/verify?token=abc to verify your email.",
    };

    await new LoggerEmailSender(logger).send(message);

    expect(logger.entries).toEqual([
      {
        level: "info",
        message: "Email not delivered, logged instead",
        context: { email: message },
      },
    ]);
  });
});
