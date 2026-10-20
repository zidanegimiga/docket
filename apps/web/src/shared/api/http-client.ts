import { getApiUrl } from "@/shared/config/api-url";

import { ApiError } from "./api-error";

type QueryValue = string | number | boolean | undefined;

export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH";
  query?: Record<string, QueryValue>;
  body?: unknown;
  signal?: AbortSignal;
}

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

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", query, body, signal } = options;
  const hasBody = body !== undefined;

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      signal: signal ?? null,
      cache: "no-store",
      headers: hasBody ? { "content-type": "application/json" } : {},
      body: hasBody ? JSON.stringify(body) : null,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError(0, "NETWORK_ERROR", "Could not reach the server");
  }

  if (!response.ok) {
    throw await toApiError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
