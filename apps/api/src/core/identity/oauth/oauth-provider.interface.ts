export interface AuthorizationRequest {
  state: string;
  nonce: string;
  codeVerifier: string;
  redirectUri: string;
}

export interface ExternalIdentity {
  provider: string;
  subject: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
}

export interface OAuthProvider {
  readonly id: string;
  readonly displayName: string;
  createAuthorizationUrl(request: AuthorizationRequest): Promise<URL>;
  completeAuthorization(callbackUrl: URL, request: AuthorizationRequest): Promise<ExternalIdentity>;
}

export class OAuthCallbackError extends Error {
  constructor(
    readonly provider: string,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "OAuthCallbackError";
  }
}
