import type { Metadata } from "next";
import Link from "next/link";

import { AuthCard } from "@/features/auth/components/AuthCard";
import { ProviderButtons } from "@/features/auth/components/ProviderButtons";
import { SignUpForm } from "@/features/auth/components/SignUpForm";

import { availableProviders } from "../providers";
import { readAuthParams, type SearchParams } from "../search-params";

export const metadata: Metadata = { title: "Create an account · Docket" };

interface SignUpPageProps {
  searchParams: SearchParams;
}

export default async function SignUpPage({ searchParams }: SignUpPageProps) {
  const { returnTo, returnQuery } = await readAuthParams(searchParams);
  const providers = await availableProviders();

  return (
    <AuthCard
      title="Create an account"
      footer={
        <>
          Already have an account? <Link href={`/login${returnQuery}`}>Sign in</Link>
        </>
      }
    >
      <SignUpForm />
      <ProviderButtons providers={providers} returnTo={returnTo} />
    </AuthCard>
  );
}
