import { beforeEach, describe, expect, it } from "vitest";

import type { PasswordHasher } from "../../src/core/identity/password-hasher.interface.js";
import { AuthService } from "../../src/modules/identity/auth.service.js";
import { InMemoryUserRepository } from "../helpers/in-memory-user.repository.js";
import { RecordingEmailSender } from "../helpers/recording.email-sender.js";
import { RecordingMonitor } from "../helpers/recording.monitor.js";

class CountingHasher implements PasswordHasher {
  hashes = 0;

  async hash(password: string): Promise<string> {
    this.hashes += 1;
    return `hashed(${password})`;
  }

  async verify(hash: string, password: string): Promise<boolean> {
    return hash === `hashed(${password})`;
  }

  needsRehash(): boolean {
    return false;
  }
}

describe("AuthService.signUp", () => {
  let users: InMemoryUserRepository;
  let hasher: CountingHasher;
  let email: RecordingEmailSender;
  let monitor: RecordingMonitor;
  let service: AuthService;

  beforeEach(() => {
    users = new InMemoryUserRepository();
    hasher = new CountingHasher();
    email = new RecordingEmailSender();
    monitor = new RecordingMonitor();
    service = new AuthService(users, hasher, email, monitor);
  });

  const jane = { email: "jane@example.com", name: "Jane", password: "correct horse battery" };

  it("creates a pending user with a hashed password and tells them approval is needed", async () => {
    await service.signUp(jane);

    expect(users.users).toEqual([
      expect.objectContaining({
        email: jane.email,
        status: "pending",
        passwordHash: "hashed(correct horse battery)",
      }),
    ]);
    expect(email.sent).toEqual([
      expect.objectContaining({
        to: jane.email,
        subject: "Your Docket account is waiting for approval",
      }),
    ]);
    expect(monitor.metrics).toEqual([{ name: "auth.signups", value: 1, tags: {} }]);
  });

  it("does the same hashing work for an existing email, creates nothing and warns the owner", async () => {
    await service.signUp(jane);
    email.sent.length = 0;
    monitor.metrics.length = 0;

    await service.signUp({ ...jane, name: "Impostor", password: "another password" });

    expect(hasher.hashes).toBe(2);
    expect(users.users).toHaveLength(1);
    expect(users.users[0]?.name).toBe("Jane");
    expect(email.sent).toEqual([
      expect.objectContaining({
        to: jane.email,
        subject: "Someone tried to sign up with your email",
      }),
    ]);
    expect(monitor.metrics).toEqual([]);
  });

  it("still completes the sign-up when the email cannot be sent, and reports the failure", async () => {
    email.failWith = new Error("SMTP down");

    await expect(service.signUp(jane)).resolves.toBeUndefined();

    expect(users.users).toHaveLength(1);
    expect(monitor.exceptions).toEqual([email.failWith]);
  });
});
