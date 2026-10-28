import type { AuthProviders } from "@docket/contracts";

import { getProviders } from "@/features/auth/api/auth.api";

/** Sign-in buttons are optional: if the API cannot say which exist, show none. */
export async function availableProviders(): Promise<AuthProviders["providers"]> {
  try {
    return (await getProviders()).providers;
  } catch {
    return [];
  }
}
