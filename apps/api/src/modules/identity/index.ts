import type { RequestHandler, Router } from "express";

import type { DatabaseProvider } from "../../core/database/database.interface.js";
import type { Identity } from "../../core/identity/identity.js";
import type { Logger } from "../../core/logger/logger.interface.js";
import type { Monitor } from "../../core/monitoring/monitor.interface.js";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { AuthController } from "./auth.controller.js";
import { authRoutes } from "./auth.routes.js";
import { AccessService } from "./access.service.js";
import { AuthService } from "./auth.service.js";
import { EmailVerificationController } from "./email-verification.controller.js";
import { emailVerificationRoutes } from "./email-verification.routes.js";
import { EmailVerificationService } from "./email-verification.service.js";
import { OAuthController } from "./oauth.controller.js";
import { oauthRoutes } from "./oauth.routes.js";
import { OAuthService } from "./oauth.service.js";
import type { SessionCookieSettings } from "./session-cookies.js";
import { PrismaRefreshTokenRepository } from "./session.repository.js";
import { PrismaUserRepository } from "./user.repository.js";
import { PrismaVerificationTokenRepository } from "./verification.repository.js";
import { WellKnownController } from "./well-known.controller.js";
import { wellKnownRoutes } from "./well-known.routes.js";

export interface IdentityModuleDeps {
  database: DatabaseProvider<PrismaClient>;
  monitor: Monitor;
  identity: Identity;
  logger: Logger;
  cookies: SessionCookieSettings;
  /** Where the web app runs; OAuth callbacks go through its /api proxy. */
  webOrigin: string;
  refreshTokenTtlDays: number;
  refreshReuseGraceSeconds: number;
  authenticate: RequestHandler;
}

export interface IdentityModule {
  /** Mounted at /auth. */
  auth: Router;
  /** Mounted at /.well-known, for services that verify our tokens. */
  wellKnown: Router;
}

export function createIdentityModule({
  database,
  monitor,
  identity,
  logger,
  cookies,
  webOrigin,
  refreshTokenTtlDays,
  refreshReuseGraceSeconds,
  authenticate,
}: IdentityModuleDeps): IdentityModule {
  const users = new PrismaUserRepository(database.client);
  const emailVerification = new EmailVerificationService({
    tokens: new PrismaVerificationTokenRepository(database.client),
    monitor,
    linkFor: (token) => `${webOrigin}${cookies.apiPrefix}/auth/verify-email?token=${token}`,
  });
  const authService = new AuthService({
    users,
    refreshTokens: new PrismaRefreshTokenRepository(database.client),
    access: new AccessService(users, logger),
    passwordHasher: identity.passwordHasher,
    tokenIssuer: identity.tokenIssuer,
    emailSender: identity.emailSender,
    emailVerifier: emailVerification,
    monitor,
    refreshTokenTtlDays,
    refreshReuseGraceSeconds,
  });

  const oauthService = new OAuthService({
    providers: identity.oauthProviders,
    auth: authService,
    monitor,
    redirectUriFor: (providerId) =>
      `${webOrigin}${cookies.apiPrefix}/auth/oauth/${providerId}/callback`,
  });

  const auth = authRoutes(
    new AuthController(authService, cookies, identity.oauthProviders),
    authenticate,
  );
  auth.use(
    "/oauth",
    oauthRoutes(new OAuthController(oauthService, monitor, { cookies, webOrigin })),
  );
  auth.use(
    "/verify-email",
    emailVerificationRoutes(new EmailVerificationController(emailVerification, webOrigin)),
  );

  return {
    auth,
    wellKnown: wellKnownRoutes(new WellKnownController(identity.tokenIssuer)),
  };
}
