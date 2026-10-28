import type { LogInBody, SignUpBody } from "@docket/contracts";
import type { RequestHandler, Response } from "express";

import type { AuthService } from "./auth.service.js";
import {
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
    const { user, tokens } = await this.service.logIn(req.body, {
      ip: req.ip ?? null,
      userAgent: req.get("user-agent") ?? null,
    });

    this.setSessionCookies(res, tokens);
    res.json({ user });
  };

  private setSessionCookies(res: Response, tokens: SessionTokens): void {
    res.set("Cache-Control", "no-store");
    for (const { name, value, options } of sessionCookies(tokens, this.cookies)) {
      res.cookie(name, value, options);
    }
  }
}
