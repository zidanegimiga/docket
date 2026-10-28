import { createAuthorizationRequest } from "../../core/identity/oauth/authorization-request.js";
import { OAuthCallbackError } from "../../core/identity/oauth/oauth-provider.interface.js";
import type { OAuthProviderRegistry } from "../../core/identity/oauth/oauth-provider.registry.js";
import type { Monitor } from "../../core/monitoring/monitor.interface.js";
import { NotFoundError } from "../../shared/errors/not-found.error.js";
import { UnauthorizedError } from "../../shared/errors/unauthorized.error.js";
import type { AuthService, ClientContext, LoginResult } from "./auth.service.js";
import type { OAuthTransaction } from "./oauth-transaction.js";

export interface OAuthServiceDeps {
  providers: OAuthProviderRegistry;
  auth: AuthService;
  monitor: Monitor;
  /** The callback URL registered with each provider. */
  redirectUriFor(providerId: string): string;
}

export interface OAuthStart {
  authorizationUrl: URL;
  transaction: OAuthTransaction;
}

export interface OAuthCompletion extends LoginResult {
  returnTo: string;
}

export class OAuthService {
  constructor(private readonly deps: OAuthServiceDeps) {}

  async begin(providerId: string, returnTo: string): Promise<OAuthStart> {
    const provider = this.deps.providers.get(providerId);
    if (!provider) throw new NotFoundError("Sign-in provider", providerId);

    const request = createAuthorizationRequest(this.deps.redirectUriFor(provider.id));
    const { state, nonce, codeVerifier } = request;
    return {
      authorizationUrl: await provider.createAuthorizationUrl(request),
      transaction: { provider: provider.id, state, nonce, codeVerifier, returnTo },
    };
  }

  async complete(
    providerId: string,
    callbackParams: URLSearchParams,
    transaction: OAuthTransaction | undefined,
    client: ClientContext,
  ): Promise<OAuthCompletion> {
    const provider = this.deps.providers.get(providerId);
    if (!provider) throw new NotFoundError("Sign-in provider", providerId);

    // Missing when the sign-in was started in another browser or took longer than allowed.
    if (transaction?.provider !== provider.id) {
      throw new UnauthorizedError("OAUTH_EXPIRED", "The sign-in took too long. Try again.");
    }

    if (callbackParams.get("error") === "access_denied") {
      throw new UnauthorizedError("OAUTH_CANCELLED", "Sign-in was cancelled");
    }

    const redirectUri = this.deps.redirectUriFor(provider.id);
    const callbackUrl = new URL(redirectUri);
    callbackUrl.search = callbackParams.toString();

    try {
      const identity = await provider.completeAuthorization(callbackUrl, {
        ...transaction,
        redirectUri,
      });
      const session = await this.deps.auth.signInWithIdentity(identity, client);
      return { ...session, returnTo: transaction.returnTo };
    } catch (error) {
      if (!(error instanceof OAuthCallbackError)) throw error;
      this.deps.monitor.recordMetric("auth.oauth_logins", 1, {
        provider: provider.id,
        outcome: "rejected",
      });
      throw new UnauthorizedError("OAUTH_FAILED", "Sign-in could not be completed. Try again.");
    }
  }
}
