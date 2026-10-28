import type { UserStatus } from "@docket/contracts";
import { beforeEach, describe, expect, it } from "vitest";

import type { PasswordHasher } from "../../src/core/identity/password-hasher.interface.js";
import type {
  AccessTokenClaims,
  IssuedToken,
  TokenIssuer,
} from "../../src/core/identity/token.interface.js";
import { AccessService } from "../../src/modules/identity/access.service.js";
import { AuthService, hashRefreshToken } from "../../src/modules/identity/auth.service.js";
import { ForbiddenError } from "../../src/shared/errors/forbidden.error.js";
import { UnauthorizedError } from "../../src/shared/errors/unauthorized.error.js";
import { InMemoryRefreshTokenRepository } from "../helpers/in-memory-refresh-token.repository.js";
import { InMemoryUserRepository } from "../helpers/in-memory-user.repository.js";
import { RecordingEmailSender } from "../helpers/recording.email-sender.js";
import { RecordingLogger } from "../helpers/recording.logger.js";
import { RecordingMonitor } from "../helpers/recording.monitor.js";

class CountingHasher implements PasswordHasher {
  hashes = 0;
  verifications: string[] = [];
  outdated = new Set<string>();

  async hash(password: string): Promise<string> {
    this.hashes += 1;
    return `hashed(${password})`;
  }

  async verify(hash: string, password: string): Promise<boolean> {
    this.verifications.push(hash);
    return hash === `hashed(${password})`;
  }

  needsRehash(hash: string): boolean {
    return this.outdated.has(hash);
  }
}

class FakeTokenIssuer implements TokenIssuer {
  issued: AccessTokenClaims[] = [];

  async issueAccessToken(claims: AccessTokenClaims): Promise<IssuedToken> {
    this.issued.push(claims);
    return { token: `access-for-${claims.userId}`, expiresAt: new Date(Date.now() + 600_000) };
  }

  publicKeys() {
    return { keys: [] };
  }
}

describe("AuthService", () => {
  let users: InMemoryUserRepository;
  let refreshTokens: InMemoryRefreshTokenRepository;
  let hasher: CountingHasher;
  let tokenIssuer: FakeTokenIssuer;
  let email: RecordingEmailSender;
  let monitor: RecordingMonitor;
  let service: AuthService;

  beforeEach(() => {
    users = new InMemoryUserRepository();
    refreshTokens = new InMemoryRefreshTokenRepository();
    hasher = new CountingHasher();
    tokenIssuer = new FakeTokenIssuer();
    email = new RecordingEmailSender();
    monitor = new RecordingMonitor();
    service = new AuthService({
      users,
      refreshTokens,
      access: new AccessService(users, new RecordingLogger()),
      passwordHasher: hasher,
      tokenIssuer,
      emailSender: email,
      monitor,
      refreshTokenTtlDays: 30,
    });
  });

  const jane = { email: "jane@example.com", name: "Jane", password: "correct horse battery" };
  const client = { ip: "203.0.113.9", userAgent: "Test browser" };

  describe("signUp", () => {
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

  describe("logIn", () => {
    const registered = async (status: UserStatus) => {
      await service.signUp(jane);
      const user = users.users[0]!;
      user.status = status;
      return user;
    };

    it("starts a session for an active user with their permissions", async () => {
      const user = await registered("active");
      users.grant(user.id, { rolePermissions: ["tickets:read", "tickets:create"] });

      const result = await service.logIn(jane, client);

      expect(result.user).toEqual({
        id: user.id,
        email: jane.email,
        name: "Jane",
        status: "active",
        permissions: ["tickets:read", "tickets:create"],
        providers: [],
        hasPassword: true,
      });
      expect(tokenIssuer.issued).toEqual([
        { userId: user.id, status: "active", permissions: ["tickets:read", "tickets:create"] },
      ]);
      expect(result.tokens.accessToken).toBe(`access-for-${user.id}`);
    });

    it("stores only a hash of the refresh token, in a new family, with client details", async () => {
      const user = await registered("active");

      const { tokens } = await service.logIn(jane, client);

      expect(refreshTokens.tokens).toEqual([
        expect.objectContaining({
          userId: user.id,
          tokenHash: hashRefreshToken(tokens.refreshToken),
          createdIp: "203.0.113.9",
          userAgent: "Test browser",
        }),
      ]);
      expect(JSON.stringify(refreshTokens.tokens)).not.toContain(tokens.refreshToken);
      expect(tokens.refreshToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
      const days = (tokens.refreshTokenExpiresAt.getTime() - Date.now()) / 86_400_000;
      expect(days).toBeCloseTo(30, 1);
    });

    it("lets a pending user sign in with no permissions so they can see they are waiting", async () => {
      const user = await registered("pending");
      users.grant(user.id, { rolePermissions: ["users:manage"] });

      const result = await service.logIn(jane, client);

      expect(result.user).toMatchObject({ status: "pending", permissions: [] });
    });

    it("refuses a disabled user only after the password checks out", async () => {
      await registered("disabled");

      await expect(service.logIn(jane, client)).rejects.toMatchObject({
        statusCode: 403,
        code: "ACCOUNT_DISABLED",
      });
      await expect(service.logIn({ ...jane, password: "wrong" }, client)).rejects.toMatchObject({
        code: "INVALID_CREDENTIALS",
      });
      expect(refreshTokens.tokens).toEqual([]);
    });

    it("answers an unknown email and a wrong password identically, verifying a hash either way", async () => {
      await registered("active");

      const unknown = await service
        .logIn({ ...jane, email: "nobody@example.com" }, client)
        .catch((e) => e);
      const wrong = await service
        .logIn({ ...jane, password: "wrong password" }, client)
        .catch((e) => e);

      for (const error of [unknown, wrong]) {
        expect(error).toBeInstanceOf(UnauthorizedError);
        expect(error).toMatchObject({
          statusCode: 401,
          code: "INVALID_CREDENTIALS",
          message: "Email or password is incorrect",
        });
      }
      expect(hasher.verifications).toHaveLength(2);
      expect(refreshTokens.tokens).toEqual([]);
    });

    it("treats an account without a password like an unknown email", async () => {
      await users.createWithIdentity({
        email: jane.email,
        name: "Jane",
        emailVerified: true,
        identity: { provider: "google", subject: "g-1", email: jane.email },
      });

      await expect(service.logIn(jane, client)).rejects.toMatchObject({
        code: "INVALID_CREDENTIALS",
      });
      expect(hasher.verifications).toHaveLength(1);
    });

    it("upgrades an outdated password hash and records the login time", async () => {
      const user = await registered("active");
      hasher.outdated.add(user.passwordHash!);
      const before = hasher.hashes;

      await service.logIn(jane, client);

      expect(hasher.hashes).toBe(before + 1);
      expect(user.lastLoginAt).toBeInstanceOf(Date);
    });

    it("never returns a ForbiddenError for a wrong password on a disabled account", async () => {
      await registered("disabled");

      const error = await service.logIn({ ...jane, password: "nope" }, client).catch((e) => e);

      expect(error).not.toBeInstanceOf(ForbiddenError);
    });
  });
});
