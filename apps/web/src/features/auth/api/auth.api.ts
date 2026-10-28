import {
  authProvidersSchema,
  currentUserSchema,
  type AuthProviders,
  type CurrentUser,
  type LogInInput,
  type SignUpInput,
} from "@docket/contracts";
import { z } from "zod";

import { request, type RequestContext } from "@/shared/api/http-client";

const userEnvelope = z.object({ user: currentUserSchema });
const messageEnvelope = z.object({ message: z.string() });

export async function getCurrentUser(
  context: RequestContext = {},
  signal?: AbortSignal,
): Promise<CurrentUser> {
  const data = await request<unknown>("/auth/me", { ...context, ...(signal && { signal }) });
  return userEnvelope.parse(data).user;
}

export async function getProviders(context: RequestContext = {}): Promise<AuthProviders> {
  return authProvidersSchema.parse(await request<unknown>("/auth/providers", context));
}

export async function logIn(input: LogInInput): Promise<CurrentUser> {
  const data = await request<unknown>("/auth/login", { method: "POST", body: input });
  return userEnvelope.parse(data).user;
}

export async function signUp(input: SignUpInput): Promise<string> {
  const data = await request<unknown>("/auth/signup", { method: "POST", body: input });
  return messageEnvelope.parse(data).message;
}

/** Renews the session now and returns the user with their current permissions. */
export async function refreshCurrentUser(): Promise<CurrentUser> {
  const data = await request<unknown>("/auth/refresh", { method: "POST" });
  return userEnvelope.parse(data).user;
}

export async function logOut(): Promise<void> {
  await request<void>("/auth/logout", { method: "POST" });
}
