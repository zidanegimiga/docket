import { cookies } from "next/headers";

import type { RequestContext } from "@/shared/api/http-client";

import { ACCESS_COOKIES, readCookie } from "./session-cookies";

/**
 * Credentials for API calls made while rendering on the server, or null when the access token
 * has lapsed; the browser then refreshes the session and loads the data itself.
 * Server-only: it reads the incoming request's cookies.
 */
export async function serverRequestContext(): Promise<RequestContext | null> {
  const token = readCookie(await cookies(), ACCESS_COOKIES);
  return token ? { headers: { Authorization: `Bearer ${token}` } } : null;
}
