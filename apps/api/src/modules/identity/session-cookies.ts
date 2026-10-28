import type { CookieOptions } from "express";

export interface SessionCookieSettings {
  secure: boolean;
  apiPrefix: string;
}

export interface SessionTokens {
  accessToken: string;
  accessTokenExpiresAt: Date;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

export interface SessionCookie {
  name: string;
  value: string;
  options: CookieOptions;
}

// Browsers only accept the __Host- and __Secure- prefixes over HTTPS, so plain names are used locally.
export function sessionCookieNames(secure: boolean) {
  return {
    access: secure ? "__Host-docket_access" : "docket_access",
    refresh: secure ? "__Secure-docket_refresh" : "docket_refresh",
  };
}

export function sessionCookies(
  tokens: SessionTokens,
  { secure, apiPrefix }: SessionCookieSettings,
): SessionCookie[] {
  const names = sessionCookieNames(secure);
  const base: CookieOptions = { httpOnly: true, secure, sameSite: "lax" };

  return [
    {
      name: names.access,
      value: tokens.accessToken,
      options: { ...base, path: "/", expires: tokens.accessTokenExpiresAt },
    },
    {
      name: names.refresh,
      value: tokens.refreshToken,
      options: { ...base, path: `${apiPrefix}/auth`, expires: tokens.refreshTokenExpiresAt },
    },
  ];
}
