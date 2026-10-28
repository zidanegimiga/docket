import type { RequestHandler } from "express";

import type { TokenIssuer } from "../../core/identity/token.interface.js";

// Long enough to spare verifiers a fetch per request, short enough that a rotated key spreads quickly.
const JWKS_MAX_AGE_SECONDS = 300;

export class WellKnownController {
  constructor(private readonly tokenIssuer: TokenIssuer) {}

  jwks: RequestHandler = (_req, res) => {
    res.set("Cache-Control", `public, max-age=${JWKS_MAX_AGE_SECONDS}`);
    res.type("application/jwk-set+json").json(this.tokenIssuer.publicKeys());
  };
}
