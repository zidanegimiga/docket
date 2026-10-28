import type { LogInBody, SignUpBody } from "@docket/contracts";
import type { Request, RequestHandler, Response } from "express";

import type { AuthService, ClientContext } from "./auth.service.js";
import {
  sessionCookieNames,
  sessionCookies,
  type SessionCookieSettings,
  type SessionTokens,
} from "./session-cookies.js";

type Params = Record<string, string>;

export const SIGN_UP_ACCEPTED_MESSAGE =
  "Thanks. Check your email for the next steps. New accounts need an administrator's approval.";

export class AuthController {
  constructor(
    private readonly service: AuthService,
    private readonly cookies: SessionCookieSettings,
  ) {}

  signUp: RequestHandler<Params, unknown, SignUpBody> = async (req, res) => {
    await this.service.signUp(req.body);
    res.status(202).json({ message: SIGN_UP_ACCEPTED_MESSAGE });
  };

  logIn: RequestHandler<Params, unknown, LogInBody> = async (req, res) => {
    const { user, tokens } = await this.service.logIn(req.body, clientContext(req));
    this.setSessionCookies(res, tokens);
    res.json({ user });
  };

  refresh: RequestHandler = async (req, res) => {
    try {
      const { user, tokens } = await this.service.refresh(
        this.refreshCookie(req),
        clientContext(req),
      );
      this.setSessionCookies(res, tokens);
      res.json({ user });
    } catch (error) {
      if (!isRotationRace(error)) this.clearSessionCookies(res);
      throw error;
    }
  };

  logOut: RequestHandler = async (req, res) => {
    await this.service.logOut(this.refreshCookie(req));
    this.clearSessionCookies(res);
    res.status(204).end();
  };

  private refreshCookie(req: Request): string | undefined {
    const value: unknown = req.cookies?.[sessionCookieNames(this.cookies.secure).refresh];
    return typeof value === "string" && value.length > 0 ? value : undefined;
  }

  private setSessionCookies(res: Response, tokens: SessionTokens): void {
    res.set("Cache-Control", "no-store");
    for (const { name, value, options } of sessionCookies(tokens, this.cookies)) {
      res.cookie(name, value, options);
    }
  }

  private clearSessionCookies(res: Response): void {
    res.set("Cache-Control", "no-store");
    const expired = {
      accessToken: "",
      refreshToken: "",
      accessTokenExpiresAt: new Date(0),
      refreshTokenExpiresAt: new Date(0),
    };
    for (const { name, options } of sessionCookies(expired, this.cookies)) {
      const { expires: _expires, ...rest } = options;
      res.clearCookie(name, rest);
    }
  }
}

function clientContext(req: Request): ClientContext {
  return { ip: req.ip ?? null, userAgent: req.get("user-agent") ?? null };
}

function isRotationRace(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === "SESSION_ROTATED";
}
