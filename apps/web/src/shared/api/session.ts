/**
 * Keeps the browser's session alive. Access tokens last minutes; when one lapses the API answers
 * 401 and the client trades the refresh cookie for a new pair, once, however many requests failed
 * at the same moment.
 */

const REFRESH_PATH = "/api/auth/refresh";
// Another tab rotated the refresh token first; its new cookies land a moment later.
const ROTATION_SETTLE_MS = 500;

let refreshing: Promise<boolean> | null = null;
let onExpired = (): void => {
  const returnTo = `${window.location.pathname}${window.location.search}`;
  const query = returnTo === "/" ? "" : `?returnTo=${encodeURIComponent(returnTo)}`;
  window.location.assign(`/login${query}`);
};

async function tryRefresh(): Promise<boolean> {
  const response = await fetch(REFRESH_PATH, { method: "POST", cache: "no-store" }).catch(
    () => null,
  );
  if (!response) return false;
  if (response.ok) return true;

  const body = (await response.json().catch(() => ({}))) as { error?: { code?: string } };
  if (body.error?.code === "SESSION_ROTATED") {
    await new Promise((resolve) => setTimeout(resolve, ROTATION_SETTLE_MS));
    return true;
  }
  return false;
}

/** Resolves true when the session was renewed. Concurrent callers share one refresh. */
export function refreshSession(): Promise<boolean> {
  refreshing ??= tryRefresh().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

/** Called when the session cannot be renewed; by default sends the user to log in. */
export function sessionExpired(): void {
  onExpired();
}

/** Replaces what happens when the session ends, for tests. */
export function setSessionExpiredHandler(handler: () => void): void {
  onExpired = handler;
}
