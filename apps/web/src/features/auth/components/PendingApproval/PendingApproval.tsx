"use client";

import type { CurrentUser } from "@docket/contracts";

import { Button } from "@/shared/components/Button";

import { useCheckApproval } from "../../hooks/useCheckApproval";
import styles from "./PendingApproval.module.css";

interface PendingApprovalProps {
  user: CurrentUser;
}

export function PendingApproval({ user }: PendingApprovalProps) {
  const checkApproval = useCheckApproval();
  const stillPending = checkApproval.isSuccess && checkApproval.data.status === "pending";

  return (
    <section className={styles.panel} aria-labelledby="pending-heading">
      <h1 id="pending-heading">Waiting for approval</h1>
      <p>
        Thanks for signing up, {user.name}. An administrator needs to approve your account before
        you can see or create tickets.
      </p>
      {user.hasPassword && (
        <p className={styles.muted}>
          While you wait, confirm your email address with the link we sent to {user.email}.
        </p>
      )}
      <div className={styles.actions}>
        <Button busy={checkApproval.isPending} onClick={() => checkApproval.mutate()}>
          {checkApproval.isPending ? "Checking…" : "Check again"}
        </Button>
        <p className={styles.muted} role="status">
          {stillPending && "Not approved yet."}
          {checkApproval.isError && "Could not check right now. Try again shortly."}
        </p>
      </div>
    </section>
  );
}
