import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/shared/api/api-error";
import { request } from "@/shared/api/http-client";
import { setSessionExpiredHandler } from "@/shared/api/session";

import { server } from "../support/server";

const unauthorized = (code: string) =>
  HttpResponse.json({ error: { code, message: code } }, { status: 401 });

describe("session refresh in the API client", () => {
  const onExpired = vi.fn();
  let refreshes: number;

  beforeEach(() => {
    refreshes = 0;
    onExpired.mockReset();
    setSessionExpiredHandler(onExpired);
  });

  afterEach(() => {
    setSessionExpiredHandler(() => {});
  });

  /** Answers 401 until the session has been refreshed, then succeeds. */
  const expiredUntilRefreshed = (refreshResponse: () => Response = () => HttpResponse.json({})) =>
    server.use(
      http.post("/api/auth/refresh", () => {
        refreshes += 1;
        return refreshResponse();
      }),
      http.get("/api/things", () =>
        refreshes > 0 ? HttpResponse.json({ ok: true }) : unauthorized("ACCESS_TOKEN_EXPIRED"),
      ),
    );

  it("renews an expired session once and retries the request", async () => {
    expiredUntilRefreshed();

    await expect(request("/things")).resolves.toEqual({ ok: true });
    expect(refreshes).toBe(1);
    expect(onExpired).not.toHaveBeenCalled();
  });

  it("shares one refresh between requests that fail together", async () => {
    expiredUntilRefreshed();

    await Promise.all([request("/things"), request("/things"), request("/things")]);

    expect(refreshes).toBe(1);
  });

  it("retries after another tab rotated the session first", async () => {
    expiredUntilRefreshed(() => unauthorized("SESSION_ROTATED"));

    await expect(request("/things")).resolves.toEqual({ ok: true });
  });

  it("sends the user to log in when the session cannot be renewed", async () => {
    expiredUntilRefreshed(() => unauthorized("SESSION_EXPIRED"));
    server.use(http.get("/api/things", () => unauthorized("ACCESS_TOKEN_EXPIRED")));

    await expect(request("/things")).rejects.toMatchObject({ status: 401 });
    expect(onExpired).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["wrong credentials at login", "post", "/auth/login", 401, "INVALID_CREDENTIALS"],
    ["a permission error", "get", "/things", 403, "PERMISSION_DENIED"],
  ] as const)("leaves %s alone", async (_, method, path, status, code) => {
    server.use(
      http.post("/api/auth/refresh", () => {
        refreshes += 1;
        return HttpResponse.json({});
      }),
      http[method](`/api${path}`, () =>
        HttpResponse.json({ error: { code, message: code } }, { status }),
      ),
    );

    const error = await request(path, { method: method === "post" ? "POST" : "GET" }).catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ code });
    expect(refreshes).toBe(0);
    expect(onExpired).not.toHaveBeenCalled();
  });

  it("signs out a user whose account was disabled while their token was still valid", async () => {
    server.use(
      http.get("/api/auth/me", () => unauthorized("SESSION_EXPIRED")),
      http.post("/api/auth/refresh", () => {
        refreshes += 1;
        return unauthorized("SESSION_EXPIRED");
      }),
    );

    await expect(request("/auth/me")).rejects.toMatchObject({ code: "SESSION_EXPIRED" });
    expect(refreshes).toBe(1);
    expect(onExpired).toHaveBeenCalledTimes(1);
  });
});
