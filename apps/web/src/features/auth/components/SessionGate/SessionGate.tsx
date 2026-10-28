"use client";

import type { ReactNode } from "react";

import { AppHeader } from "@/shared/components/AppHeader";
import { Button } from "@/shared/components/Button";

import { useCurrentUser } from "../../hooks/useCurrentUser";
import { PendingApproval } from "../PendingApproval";
import { UserMenu } from "../UserMenu";
import styles from "./SessionGate.module.css";

interface SessionGateProps {
  children: ReactNode;
  /** Section links for the header, shown once the user is known and active. */
  nav?: ReactNode;
  mainClassName?: string;
}

/**
 * Renders the signed-in app once the current user is known. Pending users see the waiting
 * screen instead; an expired session has already been sent to the login page by the API client.
 */
export function SessionGate({ children, nav, mainClassName }: SessionGateProps) {
  const { data: user, isError, refetch } = useCurrentUser();

  return (
    <>
      <AppHeader>
        {user?.status === "active" && nav}
        {user && <UserMenu user={user} />}
      </AppHeader>
      <main className={mainClassName}>
        {user ? (
          user.status === "active" ? (
            children
          ) : (
            <PendingApproval user={user} />
          )
        ) : isError ? (
          <div className={styles.message} role="alert">
            <p>Your account could not be loaded.</p>
            <Button onClick={() => void refetch()}>Try again</Button>
          </div>
        ) : (
          <p className={styles.message} aria-busy="true">
            Loading…
          </p>
        )}
      </main>
    </>
  );
}
