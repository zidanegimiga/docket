import { getApiUrl } from "@/shared/config/api-url";

import { ApiError } from "./api-error";
import { refreshSession, sessionExpired } from "./session";

type QueryValue = string | number | boolean | undefined;

export interface RequestOptions extends RequestContext {
  method?: "GET" | "POST" | "PATCH";
  query?: Record<string, QueryValue>;
  body?: unknown;
  signal?: AbortSignal;
}

/** Extra headers for one request, such as the caller's credentials when rendering on the server. */
export interface RequestContext {
  headers?: Record<string, string>;
}

// 401 codes a refreshed session can fix. Others, such as wrong credentials, are final.
// SESSION_EXPIRED here means the account was disabled or removed while the token was still
// valid; the refresh then fails too, clears the cookies and sends the user to log in.
const SESSION_ERRORS = new Set([
  "AUTHENTICATION_REQUIRED",
  "ACCESS_TOKEN_EXPIRED",
  "INVALID_ACCESS_TOKEN",
  "SESSION_EXPIRED",
]);
// Endpoints that manage the session themselves and must never trigger a refresh.
const SESSION_ENDPOINTS = ["/auth/login", "/auth/signup", "/auth/refresh", "/auth/logout"];

interface ErrorEnvelope {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
    requestId?: string;
  };
}

function baseUrl(): string {
  return typeof window === "undefined" ? getApiUrl() : "/api";
}

function buildUrl(path: string, query: RequestOptions["query"]): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) params.set(key, String(value));
  }

  const search = params.toString();
  return `${baseUrl()}${path}${search ? `?${search}` : ""}`;
}

async function toApiError(response: Response): Promise<ApiError> {
  const envelope = (await response.json().catch(() => ({}))) as ErrorEnvelope;
  const error = envelope.error ?? {};

  return new ApiError(
    response.status,
    error.code ?? "HTTP_ERROR",
    error.message ?? `Request failed with status ${response.status}`,
    error.details,
    error.requestId ?? response.headers.get("x-request-id") ?? undefined,
  );
}

async function send(path: string, options: RequestOptions): Promise<Response> {
  const { method = "GET", query, body, signal, headers } = options;
  const hasBody = body !== undefined;

  try {
    return await fetch(buildUrl(path, query), {
      method,
      signal: signal ?? null,
      cache: "no-store",
      headers: { ...(hasBody && { "content-type": "application/json" }), ...headers },
      body: hasBody ? JSON.stringify(body) : null,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError(0, "NETWORK_ERROR", "Could not reach the server");
  }
}

function canRefresh(path: string, error: ApiError): boolean {
  return (
    typeof window !== "undefined" &&
    error.status === 401 &&
    SESSION_ERRORS.has(error.code) &&
    !SESSION_ENDPOINTS.includes(path)
  );
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let response = await send(path, options);

  if (!response.ok) {
    const error = await toApiError(response);
    if (!canRefresh(path, error)) throw error;

    // Retry once with a renewed session; if that is impossible the user has to sign in again.
    if (!(await refreshSession())) {
      sessionExpired();
      throw error;
    }
    response = await send(path, options);
    if (!response.ok) {
      const retryError = await toApiError(response);
      if (canRefresh(path, retryError)) sessionExpired();
      throw retryError;
    }
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
