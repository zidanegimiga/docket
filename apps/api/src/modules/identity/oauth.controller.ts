import type { Request, RequestHandler, Response } from "express";

import type { Monitor } from "../../core/monitoring/monitor.interface.js";
import { AppError } from "../../shared/errors/app.error.js";
import { clientContext } from "./client-context.js";
import {
  oauthTransactionCookie,
  parseTransaction,
  safeReturnPath,
  serializeTransaction,
} from "./oauth-transaction.js";
import type { OAuthService } from "./oauth.service.js";
import { type SessionCookieSettings, writeSessionCookies } from "./session-cookies.js";

type ProviderParams = { provider: string };

export interface OAuthControllerSettings {
  cookies: SessionCookieSettings;
  webOrigin: string;
}

/**
 * Both endpoints are browser navigations, so outcomes are redirects to the web app rather than
 * JSON: home (or the page the user started from) on success, the login page with an error code
 * otherwise.
 */
export class OAuthController {
  constructor(
    private readonly service: OAuthService,
    private readonly monitor: Monitor,
    private readonly settings: OAuthControllerSettings,
  ) {}

  start: RequestHandler<ProviderParams> = async (req, res) => {
    res.set("Cache-Control", "no-store");
    try {
      const { authorizationUrl, transaction } = await this.service.begin(
        req.params.provider,
        safeReturnPath(req.query["returnTo"]),
      );

      const cookie = oauthTransactionCookie(this.settings.cookies);
      res.cookie(cookie.name, serializeTransaction(transaction), cookie.options);
      res.redirect(303, authorizationUrl.href);
    } catch (error) {
      // Usually the provider's discovery document could not be fetched.
      this.redirectWithError(req, res, error, "OAUTH_UNAVAILABLE");
    }
  };

  callback: RequestHandler<ProviderParams> = async (req, res) => {
    const cookie = oauthTransactionCookie(this.settings.cookies);
    const transaction = parseTransaction(req.cookies?.[cookie.name]);
    const { maxAge: _maxAge, ...clearOptions } = cookie.options;
    res.clearCookie(cookie.name, clearOptions);
    res.set("Cache-Control", "no-store");

    try {
      const { tokens, returnTo } = await this.service.complete(
        req.params.provider,
        callbackParams(req),
        transaction,
        clientContext(req),
      );
      writeSessionCookies(res, tokens, this.settings.cookies);
      this.redirectToWeb(res, returnTo);
    } catch (error) {
      this.redirectWithError(req, res, error, "OAUTH_FAILED");
    }
  };

  private redirectWithError(req: Request, res: Response, error: unknown, fallback: string): void {
    if (!(error instanceof AppError)) {
      this.monitor.captureException(error, { requestId: req.id, context: "auth.oauth" });
    }
    const code = error instanceof AppError ? error.code : fallback;
    this.redirectToWeb(res, `/login?error=${encodeURIComponent(code)}`);
  }

  private redirectToWeb(res: Response, path: string): void {
    res.redirect(303, new URL(path, this.settings.webOrigin).href);
  }
}

function callbackParams(req: Request): URLSearchParams {
  return new URL(req.originalUrl, "http://callback.invalid").searchParams;
}
