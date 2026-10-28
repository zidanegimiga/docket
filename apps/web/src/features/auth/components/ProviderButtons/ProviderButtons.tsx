import type { AuthProviders } from "@docket/contracts";

import { buttonClassName } from "@/shared/components/Button";

import styles from "./ProviderButtons.module.css";

interface ProviderButtonsProps {
  providers: AuthProviders["providers"];
  returnTo: string;
}

/** Plain links: the API starts the provider's flow and the browser follows its redirects. */
export function ProviderButtons({ providers, returnTo }: ProviderButtonsProps) {
  if (providers.length === 0) return null;

  const query = returnTo === "/" ? "" : `?returnTo=${encodeURIComponent(returnTo)}`;

  return (
    <div className={styles.providers}>
      <p className={styles.divider}>
        <span>or</span>
      </p>
      {providers.map((provider) => (
        <a
          key={provider.id}
          className={`${buttonClassName()} ${styles.provider}`}
          href={`/api/auth/oauth/${encodeURIComponent(provider.id)}${query}`}
        >
          Continue with {provider.name}
        </a>
      ))}
    </div>
  );
}
