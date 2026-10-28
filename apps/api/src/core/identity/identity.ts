import type { Env } from "../config/env.js";
import type { EmailSender } from "../email/email-sender.interface.js";
import { LoggerEmailSender } from "../email/logger.email-sender.js";
import type { Logger } from "../logger/logger.interface.js";
import { Argon2PasswordHasher } from "./argon2.password-hasher.js";
import { JoseTokenIssuer } from "./jose.token-issuer.js";
import { JoseTokenVerifier } from "./jose.token-verifier.js";
import type { OAuthProvider } from "./oauth/oauth-provider.interface.js";
import { OAuthProviderRegistry } from "./oauth/oauth-provider.registry.js";
import { OidcProvider } from "./oauth/oidc.provider.js";
import type { PasswordHasher } from "./password-hasher.interface.js";
import { generateSigningKeyJwk, loadSigningKey } from "./signing-key.js";
import type { TokenIssuer, TokenVerifier } from "./token.interface.js";

export interface Identity {
  passwordHasher: PasswordHasher;
  tokenIssuer: TokenIssuer;
  tokenVerifier: TokenVerifier;
  oauthProviders: OAuthProviderRegistry;
  emailSender: EmailSender;
}

function oauthProvidersFrom(env: Env): OAuthProvider[] {
  const providers: OAuthProvider[] = [];

  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    providers.push(
      new OidcProvider({
        id: "google",
        displayName: "Google",
        issuer: new URL("https://accounts.google.com"),
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
      }),
    );
  }

  return providers;
}

export type IdentityOverrides = Partial<Pick<Identity, "emailSender">>;

export async function createIdentity(
  env: Env,
  logger: Logger,
  overrides: IdentityOverrides = {},
): Promise<Identity> {
  let serializedKey = env.AUTH_PRIVATE_KEY;
  if (!serializedKey) {
    logger.warn("No AUTH_PRIVATE_KEY set; using a temporary signing key until restart");
    serializedKey = await generateSigningKeyJwk();
  }

  const signingKey = await loadSigningKey(serializedKey);
  const tokenSettings = { issuer: env.AUTH_ISSUER, audience: env.AUTH_AUDIENCE };
  const tokenIssuer = new JoseTokenIssuer(signingKey, {
    ...tokenSettings,
    accessTokenTtlSeconds: env.ACCESS_TOKEN_TTL_SECONDS,
  });

  const emailSender =
    overrides.emailSender ?? new LoggerEmailSender(logger.child({ component: "email" }));
  if (env.NODE_ENV === "production" && !overrides.emailSender) {
    logger.warn("Emails are written to the log instead of being delivered");
  }

  const oauthProviders = new OAuthProviderRegistry(oauthProvidersFrom(env));
  logger.info("Sign-in providers configured", {
    providers: ["password", ...oauthProviders.list().map((provider) => provider.id)],
  });

  return {
    passwordHasher: new Argon2PasswordHasher(),
    tokenIssuer,
    tokenVerifier: JoseTokenVerifier.fromKeySet(tokenIssuer.publicKeys(), tokenSettings),
    oauthProviders,
    emailSender,
  };
}
