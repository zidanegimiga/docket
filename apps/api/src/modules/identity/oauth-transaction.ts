import type { CookieOptions } from "express";
import { z } from "zod";

import type { SessionCookieSettings } from "./session-cookies.js";

export const OAUTH_TRANSACTION_TTL_MS = 10 * 60 * 1000;
const RETURN_PATH_MAX_LENGTH = 512;

const transactionSchema = z.object({
  provider: z.string().min(1),
  state: z.string().min(1),
  nonce: z.string().min(1),
  codeVerifier: z.string().min(1),
  returnTo: z.string(),
});

/** What the callback needs to finish a sign-in the browser started. */
export type OAuthTransaction = z.infer<typeof transactionSchema>;

export function oauthTransactionCookie({ secure, apiPrefix }: SessionCookieSettings) {
  const options: CookieOptions = {
    httpOnly: true,
    secure,
    // Lax still sends the cookie on the provider's top-level redirect back to the callback.
    sameSite: "lax",
    path: `${apiPrefix}/auth/oauth`,
    maxAge: OAUTH_TRANSACTION_TTL_MS,
  };
  return { name: secure ? "__Secure-docket_oauth" : "docket_oauth", options };
}

export function serializeTransaction(transaction: OAuthTransaction): string {
  return Buffer.from(JSON.stringify(transaction)).toString("base64url");
}

export function parseTransaction(value: unknown): OAuthTransaction | undefined {
  if (typeof value !== "string" || value.length === 0) return undefined;
  try {
    const result = transactionSchema.safeParse(
      JSON.parse(Buffer.from(value, "base64url").toString()),
    );
    return result.success ? result.data : undefined;
  } catch {
    return undefined;
  }
}

/** Keeps post-sign-in redirects on the web app: only same-site paths survive. */
export function safeReturnPath(value: unknown): string {
  if (typeof value !== "string" || value.length > RETURN_PATH_MAX_LENGTH) return "/";
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/";

  const base = "http://return.invalid";
  const url = new URL(value, base);
  return url.origin === base ? `${url.pathname}${url.search}${url.hash}` : "/";
}
