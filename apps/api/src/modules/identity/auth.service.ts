import { createHash, randomBytes, randomUUID } from "node:crypto";

import type { CurrentUser, LogInBody, SignUpBody } from "@docket/contracts";

import type { EmailMessage, EmailSender } from "../../core/email/email-sender.interface.js";
import type { PasswordHasher } from "../../core/identity/password-hasher.interface.js";
import type { TokenIssuer } from "../../core/identity/token.interface.js";
import type { Monitor } from "../../core/monitoring/monitor.interface.js";
import { ForbiddenError } from "../../shared/errors/forbidden.error.js";
import { UnauthorizedError } from "../../shared/errors/unauthorized.error.js";
import type { AccessService } from "./access.service.js";
import type { SessionTokens } from "./session-cookies.js";
import type { RefreshTokenRepository } from "./session.types.js";
import type { UserRecord, UserRepository } from "./user.types.js";

export interface AuthServiceDeps {
  users: UserRepository;
  refreshTokens: RefreshTokenRepository;
  access: AccessService;
  passwordHasher: PasswordHasher;
  tokenIssuer: TokenIssuer;
  emailSender: EmailSender;
  monitor: Monitor;
  refreshTokenTtlDays: number;
}

export interface ClientContext {
  ip: string | null;
  userAgent: string | null;
}

export interface LoginResult {
  user: CurrentUser;
  tokens: SessionTokens;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const USER_AGENT_MAX_LENGTH = 255;

export const hashRefreshToken = (token: string) => createHash("sha256").update(token).digest("hex");

const invalidCredentials = () =>
  new UnauthorizedError("INVALID_CREDENTIALS", "Email or password is incorrect");

export class AuthService {
  private dummyHash: Promise<string> | undefined;

  constructor(private readonly deps: AuthServiceDeps) {}

  async signUp({ email, name, password }: SignUpBody): Promise<void> {
    // Hash before checking for an existing account so both outcomes take the same time.
    const passwordHash = await this.deps.passwordHasher.hash(password);
    const user = await this.deps.users.createWithPassword({ email, name, passwordHash });

    if (user) {
      this.deps.monitor.recordMetric("auth.signups", 1);
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

  async logIn({ email, password }: LogInBody, client: ClientContext): Promise<LoginResult> {
    const user = await this.deps.users.findByEmail(email);

    if (!user?.passwordHash) {
      // Verify against a throwaway hash so unknown emails take as long as wrong passwords.
      await this.deps.passwordHasher.verify(await this.getDummyHash(), password);
      this.deps.monitor.recordMetric("auth.logins", 1, { outcome: "rejected" });
      throw invalidCredentials();
    }

    if (!(await this.deps.passwordHasher.verify(user.passwordHash, password))) {
      this.deps.monitor.recordMetric("auth.logins", 1, { outcome: "rejected" });
      throw invalidCredentials();
    }

    if (user.status === "disabled") {
      this.deps.monitor.recordMetric("auth.logins", 1, { outcome: "disabled" });
      throw new ForbiddenError("ACCOUNT_DISABLED", "This account has been disabled");
    }

    if (this.deps.passwordHasher.needsRehash(user.passwordHash)) {
      await this.deps.users.updatePasswordHash(
        user.id,
        await this.deps.passwordHasher.hash(password),
      );
    }

    const now = new Date();
    await this.deps.users.recordLogin(user.id, now);
    this.deps.monitor.recordMetric("auth.logins", 1, { outcome: "success" });

    return this.startSession(user, client, now);
  }

  private async startSession(
    user: UserRecord,
    client: ClientContext,
    now: Date,
  ): Promise<LoginResult> {
    const access = await this.deps.access.resolve(user.id);
    if (!access) throw invalidCredentials();

    const { token: accessToken, expiresAt: accessTokenExpiresAt } =
      await this.deps.tokenIssuer.issueAccessToken(access);

    const refreshToken = randomBytes(32).toString("base64url");
    const refreshTokenExpiresAt = new Date(now.getTime() + this.deps.refreshTokenTtlDays * DAY_MS);
    await this.deps.refreshTokens.create({
      userId: user.id,
      familyId: randomUUID(),
      tokenHash: hashRefreshToken(refreshToken),
      expiresAt: refreshTokenExpiresAt,
      createdIp: client.ip,
      userAgent: client.userAgent?.slice(0, USER_AGENT_MAX_LENGTH) ?? null,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        status: access.status,
        permissions: access.permissions,
        providers: await this.deps.users.listProviders(user.id),
        hasPassword: user.passwordHash !== null,
      },
      tokens: { accessToken, accessTokenExpiresAt, refreshToken, refreshTokenExpiresAt },
    };
  }

  private getDummyHash(): Promise<string> {
    this.dummyHash ??= this.deps.passwordHasher.hash(randomBytes(16).toString("hex"));
    return this.dummyHash;
  }

  private async sendQuietly(message: EmailMessage): Promise<void> {
    try {
      await this.deps.emailSender.send(message);
    } catch (error) {
      this.deps.monitor.captureException(error, {
        context: "auth.email",
        subject: message.subject,
      });
    }
  }
}
