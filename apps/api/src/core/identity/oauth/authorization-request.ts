import { randomBytes } from "node:crypto";

import type { AuthorizationRequest } from "./oauth-provider.interface.js";

const randomValue = () => randomBytes(32).toString("base64url");

export function createAuthorizationRequest(redirectUri: string): AuthorizationRequest {
  return {
    state: randomValue(),
    nonce: randomValue(),
    codeVerifier: randomValue(),
    redirectUri,
  };
}
