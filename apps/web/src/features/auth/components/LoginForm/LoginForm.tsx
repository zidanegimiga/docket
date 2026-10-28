"use client";

import { logInSchema, type LogInInput } from "@docket/contracts";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { ApiError } from "@/shared/api/api-error";
import { Button } from "@/shared/components/Button";
import { TextField } from "@/shared/components/TextField";
import { toFieldErrors, type FieldErrors } from "@/shared/forms/field-errors";

import { useLogIn } from "../../hooks/useLogIn";
import { credentialErrorMessage } from "../../messages";
import styles from "../auth-form.module.css";

const FIELDS = ["email", "password"] as const;
type Field = (typeof FIELDS)[number];

interface LoginFormProps {
  returnTo: string;
}

function readForm(form: HTMLFormElement): LogInInput {
  const data = new FormData(form);
  return { email: String(data.get("email") ?? ""), password: String(data.get("password") ?? "") };
}

export function LoginForm({ returnTo }: LoginFormProps) {
  const router = useRouter();
  const logIn = useLogIn();
  const [errors, setErrors] = useState<FieldErrors<Field>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    const parsed = logInSchema.safeParse(readForm(event.currentTarget));
    if (!parsed.success) {
      const issues = parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      }));
      setErrors(toFieldErrors(issues, FIELDS));
      return;
    }

    setErrors({});
    logIn.mutate(parsed.data, {
      onSuccess: () => {
        router.replace(returnTo);
        router.refresh();
      },
      onError: (error) => {
        setFormError(credentialErrorMessage(error instanceof ApiError ? error.code : ""));
      },
    });
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <TextField
        name="email"
        type="email"
        label="Email"
        autoComplete="email"
        required
        error={errors.email}
      />
      <TextField
        name="password"
        type="password"
        label="Password"
        autoComplete="current-password"
        required
        error={errors.password}
      />
      {formError && (
        <p className={styles.formError} role="alert">
          {formError}
        </p>
      )}
      <Button type="submit" variant="primary" busy={logIn.isPending} className={styles.submit}>
        {logIn.isPending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
