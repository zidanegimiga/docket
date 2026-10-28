import type { OAuthProvider } from "./oauth-provider.interface.js";

export interface ProviderSummary {
  id: string;
  name: string;
}

export class OAuthProviderRegistry {
  private readonly providers: ReadonlyMap<string, OAuthProvider>;

  constructor(providers: OAuthProvider[]) {
    const byId = new Map<string, OAuthProvider>();
    for (const provider of providers) {
      if (byId.has(provider.id)) {
        throw new Error(`OAuth provider "${provider.id}" is registered twice`);
      }
      byId.set(provider.id, provider);
    }
    this.providers = byId;
  }

  get(id: string): OAuthProvider | undefined {
    return this.providers.get(id);
  }

  list(): ProviderSummary[] {
    return [...this.providers.values()].map(({ id, displayName }) => ({ id, name: displayName }));
  }
}
