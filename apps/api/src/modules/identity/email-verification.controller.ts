import type { RequestHandler, Response } from "express";

import { AppError } from "../../shared/errors/app.error.js";
import type { EmailVerificationService } from "./email-verification.service.js";

/** The link is opened from an email, so the outcome is a redirect to the web app's login page. */
export class EmailVerificationController {
  constructor(
    private readonly service: EmailVerificationService,
    private readonly webOrigin: string,
  ) {}

  verify: RequestHandler = async (req, res) => {
    res.set("Cache-Control", "no-store");
    try {
      await this.service.verify(req.query["token"]);
      this.redirectToLogin(res, "verified=1");
    } catch (error) {
      if (!(error instanceof AppError)) throw error;
      this.redirectToLogin(res, `error=${encodeURIComponent(error.code)}`);
    }
  };

  private redirectToLogin(res: Response, query: string): void {
    res.redirect(303, new URL(`/login?${query}`, this.webOrigin).href);
  }
}
