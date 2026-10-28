import { safeReturnPath } from "@/features/auth/return-path";

export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export async function readAuthParams(searchParams: SearchParams) {
  const params = await searchParams;
  const returnTo = safeReturnPath(first(params["returnTo"]));
  return {
    returnTo,
    error: first(params["error"]),
    verified: first(params["verified"]) === "1",
    /** Appended to links between login and sign-up so the destination survives. */
    returnQuery: returnTo === "/" ? "" : `?returnTo=${encodeURIComponent(returnTo)}`,
  };
}
