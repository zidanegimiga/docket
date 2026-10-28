// Set by the API. Over HTTPS the names carry the __Host- prefix, so both spellings are checked.
const named = (name: string) => [`__Host-${name}`, name];

export const ACCESS_COOKIES = named("docket_access");
/** Readable hint that a session exists; holds no credential. */
export const SESSION_HINT_COOKIES = named("docket_session");

interface CookieReader {
  get(name: string): { value: string } | undefined;
}

export function readCookie(cookies: CookieReader, names: readonly string[]): string | undefined {
  for (const name of names) {
    const value = cookies.get(name)?.value;
    if (value) return value;
  }
  return undefined;
}
