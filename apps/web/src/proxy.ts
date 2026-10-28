import { NextResponse, type NextRequest } from "next/server";

import { ACCESS_COOKIES, readCookie, SESSION_HINT_COOKIES } from "@/features/auth/session-cookies";

const AUTH_PAGES = new Set(["/login", "/signup"]);

/**
 * An optimistic check only: it reads which cookies exist, never whether they are valid. The API
 * authorizes every request, and the browser refreshes or ends sessions that turn out stale.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasAccess = readCookie(request.cookies, ACCESS_COOKIES) !== undefined;
  const hasSession = hasAccess || readCookie(request.cookies, SESSION_HINT_COOKIES) !== undefined;

  if (AUTH_PAGES.has(pathname)) {
    return hasAccess ? NextResponse.redirect(new URL("/", request.url)) : NextResponse.next();
  }

  if (!hasSession) {
    const login = new URL("/login", request.url);
    const returnTo = `${pathname}${search}`;
    if (returnTo !== "/") login.searchParams.set("returnTo", returnTo);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  // Pages only: not the API proxy, Next's own assets or files such as favicon.ico.
  matcher: ["/((?!api/|_next/|.*\\.[a-z0-9]+$).*)"],
};
