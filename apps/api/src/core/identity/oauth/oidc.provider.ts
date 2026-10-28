import * as client from "openid-client";

import {
  OAuthCallbackError,
  type AuthorizationRequest,
  type ExternalIdentity,
  type OAuthProvider,
} from "./oauth-provider.interface.js";

export interface OidcProviderConfig {
  id: string;
  displayName: string;
  issuer: URL;
  clientId: string;
  clientSecret: string;
  scopes?: string[];
  allowInsecureRequests?: boolean;
}

const DEFAULT_SCOPES = ["openid", "email", "profile"];

export class OidcProvider implements OAuthProvider {
  private configuration: Promise<client.Configuration> | undefined;

  constructor(private readonly config: OidcProviderConfig) {}

  get id(): string {
    return this.config.id;
  }

  get displayName(): string {
    return this.config.displayName;
  }

  async createAuthorizationUrl(request: AuthorizationRequest): Promise<URL> {
    const configuration = await this.discover();

    return client.buildAuthorizationUrl(configuration, {
      redirect_uri: request.redirectUri,
      scope: (this.config.scopes ?? DEFAULT_SCOPES).join(" "),
      state: request.state,
      nonce: request.nonce,
      code_challenge: await client.calculatePKCECodeChallenge(request.codeVerifier),
      code_challenge_method: "S256",
    });
  }

  async completeAuthorization(
    callbackUrl: URL,
    request: AuthorizationRequest,
  ): Promise<ExternalIdentity> {
    const configuration = await this.discover();

    let claims: client.IDToken | undefined;
    try {
      const tokens = await client.authorizationCodeGrant(configuration, callbackUrl, {
        pkceCodeVerifier: request.codeVerifier,
        expectedState: request.state,
        expectedNonce: request.nonce,
        idTokenExpected: true,
      });
      claims = tokens.claims();
    } catch (error) {
      throw new OAuthCallbackError(this.id, "The sign-in response could not be verified", {
        cause: error,
      });
    }

    if (!claims) {
      throw new OAuthCallbackError(this.id, "The provider did not return an ID token");
    }

    return {
      provider: this.id,
      subject: claims.sub,
      email: typeof claims.email === "string" ? claims.email.trim().toLowerCase() : null,
      emailVerified: claims.email_verified === true,
      name: typeof claims.name === "string" ? claims.name : null,
    };
  }

  private discover(): Promise<client.Configuration> {
    this.configuration ??= client
      .discovery(
        this.config.issuer,
        this.config.clientId,
        this.config.clientSecret,
        undefined,
        this.config.allowInsecureRequests ? { execute: [client.allowInsecureRequests] } : undefined,
      )
      .catch((error: unknown) => {
        this.configuration = undefined;
        throw error;
      });

    return this.configuration;
  }
}
