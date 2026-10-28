import type { LogInBody, SignUpBody } from "@docket/contracts";
import type { Request, RequestHandler, Response } from "express";

import type { OAuthProviderRegistry } from "../../core/identity/oauth/oauth-provider.registry.js";
import { principalOf } from "../../shared/middleware/authenticate.middleware.js";

import type { AuthService } from "./auth.service.js";
import { clientContext } from "./client-context.js";
import {
  clearSessionCookies,
  sessionCookieNames,
  type SessionCookieSettings,
  writeSessionCookies,
} from "./session-cookies.js";

type Params = Record<string, string>;

export const SIGN_UP_ACCEPTED_MESSAGE =
  "Thanks. Check your email for the next steps. New accounts need an administrator's approval.";

export class AuthController {
  constructor(
    private readonly service: AuthService,
    private readonly cookies: SessionCookieSettings,
    private readonly oauthProviders: OAuthProviderRegistry,
  ) {}

  signUp: RequestHandler<Params, unknown, SignUpBody> = async (req, res) => {
    await this.service.signUp(req.body);
    res.status(202).json({ message: SIGN_UP_ACCEPTED_MESSAGE });
  };

  logIn: RequestHandler<Params, unknown, LogInBody> = async (req, res) => {
    const { user, tokens } = await this.service.logIn(req.body, clientContext(req));
    writeSessionCookies(res, tokens, this.cookies);
    res.json({ user });
  };

  refresh: RequestHandler = async (req, res) => {
    try {
      const { user, tokens } = await this.service.refresh(
        this.refreshCookie(req),
        clientContext(req),
      );
      writeSessionCookies(res, tokens, this.cookies);
      res.json({ user });
    } catch (error) {
      if (!isRotationRace(error)) clearSessionCookies(res, this.cookies);
      throw error;
    }
  };

  logOut: RequestHandler = async (req, res) => {
    await this.service.logOut(this.refreshCookie(req));
    clearSessionCookies(res, this.cookies);
    res.status(204).end();
  };

  me: RequestHandler = async (req, res) => {
    const user = await this.service.currentUser(principalOf(req));
    res.set("Cache-Control", "no-store");
    res.json({ user });
  };

  providers: RequestHandler = (_req, res) => {
    res.json({ providers: this.oauthProviders.list() });
  };

  private refreshCookie(req: Request): string | undefined {
    const value: unknown = req.cookies?.[sessionCookieNames(this.cookies.secure).refresh];
    return typeof value === "string" && value.length > 0 ? value : undefined;
  }
}

function isRotationRace(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === "SESSION_ROTATED";
}
