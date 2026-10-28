import type { SignUpBody } from "@docket/contracts";
import type { RequestHandler } from "express";

import type { AuthService } from "./auth.service.js";

type Params = Record<string, string>;

export const SIGN_UP_ACCEPTED_MESSAGE =
  "Thanks. Check your email for the next steps. New accounts need an administrator's approval.";

export class AuthController {
  constructor(private readonly service: AuthService) {}

  signUp: RequestHandler<Params, unknown, SignUpBody> = async (req, res) => {
    await this.service.signUp(req.body);
    res.status(202).json({ message: SIGN_UP_ACCEPTED_MESSAGE });
  };
}
