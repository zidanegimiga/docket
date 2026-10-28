import type { Metadata } from "next";
import Link from "next/link";

import { AuthCard } from "@/features/auth/components/AuthCard";
import { LoginForm } from "@/features/auth/components/LoginForm";
import { ProviderButtons } from "@/features/auth/components/ProviderButtons";
import { loginErrorMessage } from "@/features/auth/messages";

import styles from "../auth-layout.module.css";
import { availableProviders } from "../providers";
import { readAuthParams, type SearchParams } from "../search-params";

export const metadata: Metadata = { title: "Sign in · Docket" };

interface LoginPageProps {
  searchParams: SearchParams;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { returnTo, error, verified, returnQuery } = await readAuthParams(searchParams);
  const providers = await availableProviders();
  const errorMessage = loginErrorMessage(error);

  return (
    <AuthCard
      title="Sign in"
      footer={
        <>
          No account yet? <Link href={`/signup${returnQuery}`}>Create one</Link>
        </>
      }
    >
      {verified && (
        <p className={styles.notice} role="status">
          Email confirmed. You can sign in.
        </p>
      )}
      {errorMessage && (
        <p className={styles.error} role="alert">
          {errorMessage}
        </p>
      )}
      <LoginForm returnTo={returnTo} />
      <ProviderButtons providers={providers} returnTo={returnTo} />
    </AuthCard>
  );
}
