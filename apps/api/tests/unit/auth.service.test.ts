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
  let clock: Date;

  beforeEach(() => {
    clock = new Date();
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
      refreshReuseGraceSeconds: 30,
      now: () => clock,
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

  describe("refresh", () => {
    const signedIn = async () => {
      await service.signUp(jane);
      const user = users.users[0]!;
      user.status = "active";
      users.grant(user.id, { rolePermissions: ["tickets:read"] });
      const { tokens } = await service.logIn(jane, client);
      return { user, refreshToken: tokens.refreshToken };
    };
    const advance = (seconds: number) => {
      clock = new Date(clock.getTime() + seconds * 1000);
    };

    it("rotates the refresh token within the same family and re-reads permissions", async () => {
      const { user, refreshToken } = await signedIn();
      users.grant(user.id, { rolePermissions: ["tickets:read", "tickets:update:any"] });

      const result = await service.refresh(refreshToken, client);

      expect(result.tokens.refreshToken).not.toBe(refreshToken);
      expect(result.user.permissions).toEqual(["tickets:read", "tickets:update:any"]);
      const [original, replacement] = refreshTokens.tokens;
      expect(original).toMatchObject({ revokedAt: clock, replacedById: replacement!.id });
      expect(replacement).toMatchObject({ familyId: original!.familyId, revokedAt: null });
    });

    it("asks a second tab to retry when the token was rotated moments ago", async () => {
      const { refreshToken } = await signedIn();
      await service.refresh(refreshToken, client);
      advance(29);

      await expect(service.refresh(refreshToken, client)).rejects.toMatchObject({
        code: "SESSION_ROTATED",
      });
      expect(refreshTokens.tokens.filter((token) => !token.revokedAt)).toHaveLength(1);
      expect(monitor.exceptions).toEqual([]);
    });

    it("treats a rotated token presented after the grace period as theft and ends the family", async () => {
      const { refreshToken } = await signedIn();
      const { tokens: current } = await service.refresh(refreshToken, client);
      advance(31);

      await expect(service.refresh(refreshToken, client)).rejects.toMatchObject({
        code: "SESSION_EXPIRED",
      });

      expect(refreshTokens.tokens.every((token) => token.revokedAt)).toBe(true);
      await expect(service.refresh(current.refreshToken, client)).rejects.toMatchObject({
        code: "SESSION_EXPIRED",
      });
      expect(monitor.exceptions).toEqual([new Error("Refresh token reuse detected")]);
      expect(monitor.metrics).toContainEqual({
        name: "auth.refresh_token_reuse",
        value: 1,
        tags: {},
      });
    });

    it.each([
      ["no token", undefined],
      ["an unknown token", "not-a-real-token"],
    ])("rejects %s as an ended session", async (_, token) => {
      await expect(service.refresh(token, client)).rejects.toMatchObject({
        code: "SESSION_EXPIRED",
      });
    });

    it("rejects an expired token", async () => {
      const { refreshToken } = await signedIn();
      advance(31 * 86_400);

      await expect(service.refresh(refreshToken, client)).rejects.toMatchObject({
        code: "SESSION_EXPIRED",
      });
    });

    it("ends the session of a user who was disabled since signing in", async () => {
      const { user, refreshToken } = await signedIn();
      user.status = "disabled";

      await expect(service.refresh(refreshToken, client)).rejects.toMatchObject({
        code: "SESSION_EXPIRED",
      });
      expect(refreshTokens.tokens.every((token) => token.revokedAt)).toBe(true);
    });

    it("drops permissions for a user moved back to pending without ending the session", async () => {
      const { user, refreshToken } = await signedIn();
      user.status = "pending";

      const result = await service.refresh(refreshToken, client);

      expect(result.user).toMatchObject({ status: "pending", permissions: [] });
    });
  });

  describe("signInWithIdentity", () => {
    const google = {
      provider: "google",
      subject: "google-42",
      email: "jane@example.com",
      emailVerified: true,
      name: "Jane Doe",
    };

    it("registers a new identity as a pending user and starts a session", async () => {
      const result = await service.signInWithIdentity(google, client);

      expect(users.users).toHaveLength(1);
      expect(users.users[0]).toMatchObject({
        email: "jane@example.com",
        name: "Jane Doe",
        status: "pending",
        passwordHash: null,
        emailVerifiedAt: expect.any(Date),
      });
      expect(result.user).toMatchObject({
        status: "pending",
        permissions: [],
        providers: ["google"],
      });
      expect(refreshTokens.tokens).toHaveLength(1);
      expect(email.sent.map((message) => message.subject)).toEqual([
        "Your Docket account is waiting for approval",
      ]);
    });

    it("signs a returning identity in to the same account without registering again", async () => {
      const first = await service.signInWithIdentity(google, client);
      email.sent.length = 0;

      const second = await service.signInWithIdentity({ ...google, name: "Renamed" }, client);

      expect(second.user.id).toBe(first.user.id);
      expect(users.users).toHaveLength(1);
      expect(email.sent).toEqual([]);
    });

    it("links to an existing account when both sides have verified the email", async () => {
      await service.signUp(jane);
      const existing = users.users[0]!;
      existing.emailVerifiedAt = new Date();

      const result = await service.signInWithIdentity(google, client);

      expect(result.user).toMatchObject({
        id: existing.id,
        providers: ["google"],
        hasPassword: true,
      });
      expect(users.users).toHaveLength(1);
    });

    it("refuses to link to an account whose email was never verified", async () => {
      await service.signUp(jane);

      await expect(service.signInWithIdentity(google, client)).rejects.toMatchObject({
        statusCode: 403,
        code: "OAUTH_ACCOUNT_EXISTS",
      });
      expect(users.identities).toEqual([]);
    });

    it.each([
      { label: "an unverified email", identity: { ...google, emailVerified: false } },
      { label: "no email", identity: { ...google, email: null } },
    ])("refuses an identity with $label", async ({ identity }) => {
      await expect(service.signInWithIdentity(identity, client)).rejects.toMatchObject({
        code: "OAUTH_EMAIL_UNVERIFIED",
      });
      expect(users.users).toEqual([]);
    });

    it("refuses a disabled account without starting a session", async () => {
      await service.signInWithIdentity(google, client);
      users.users[0]!.status = "disabled";
      refreshTokens.tokens.length = 0;

      await expect(service.signInWithIdentity(google, client)).rejects.toMatchObject({
        code: "ACCOUNT_DISABLED",
      });
      expect(refreshTokens.tokens).toEqual([]);
    });

    it("falls back to the email's local part when the provider gives no name", async () => {
      await service.signInWithIdentity({ ...google, name: "  " }, client);

      expect(users.users[0]!.name).toBe("jane");
    });
  });

  describe("currentUser", () => {
    it("reports what the access token grants, not what changed since it was issued", async () => {
      await service.signUp(jane);
      const user = users.users[0]!;
      user.status = "active";

      const result = await service.currentUser({
        userId: user.id,
        status: "pending",
        permissions: [],
      });

      expect(result).toEqual({
        id: user.id,
        email: jane.email,
        name: jane.name,
        status: "pending",
        permissions: [],
        providers: [],
        hasPassword: true,
      });
    });

    it.each([
      { label: "has since been disabled", status: "disabled" as UserStatus, exists: true },
      { label: "no longer exists", status: "active" as UserStatus, exists: false },
    ])("ends the session of a user who $label", async ({ status, exists }) => {
      await service.signUp(jane);
      const user = users.users[0]!;
      user.status = status;

      await expect(
        service.currentUser({
          userId: exists ? user.id : "0199c3a2-0000-7000-8000-000000000000",
          status: "active",
          permissions: ["tickets:read"],
        }),
      ).rejects.toMatchObject({ statusCode: 401, code: "SESSION_EXPIRED" });
    });
  });

  describe("logOut", () => {
    it("revokes the whole session family and ignores missing or unknown tokens", async () => {
      await service.signUp(jane);
      users.users[0]!.status = "active";
      const { tokens } = await service.logIn(jane, client);
      await service.logIn(jane, client);

      await service.logOut(tokens.refreshToken);
      await service.logOut(undefined);
      await service.logOut("unknown");

      expect(refreshTokens.tokens.map((token) => Boolean(token.revokedAt))).toEqual([true, false]);
    });
  });
});
