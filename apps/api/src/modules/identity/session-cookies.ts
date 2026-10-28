import type { CookieOptions, Response } from "express";

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
    hint: secure ? "__Host-docket_session" : "docket_session",
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
    {
      // Says a session exists, nothing more. Page requests never carry the refresh cookie, so the
      // web app uses this to tell a lapsed access token from a visitor who never signed in.
      name: names.hint,
      value: "1",
      options: { ...base, httpOnly: false, path: "/", expires: tokens.refreshTokenExpiresAt },
    },
  ];
}

export function writeSessionCookies(
  res: Response,
  tokens: SessionTokens,
  settings: SessionCookieSettings,
): void {
  res.set("Cache-Control", "no-store");
  for (const { name, value, options } of sessionCookies(tokens, settings)) {
    res.cookie(name, value, options);
  }
}

export function clearSessionCookies(res: Response, settings: SessionCookieSettings): void {
  res.set("Cache-Control", "no-store");
  const expired = {
    accessToken: "",
    refreshToken: "",
    accessTokenExpiresAt: new Date(0),
    refreshTokenExpiresAt: new Date(0),
  };
  for (const { name, options } of sessionCookies(expired, settings)) {
    const { expires: _expires, ...rest } = options;
    res.clearCookie(name, rest);
  }
}
