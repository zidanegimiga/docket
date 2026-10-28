"use client";

import {
  EMAIL_MAX_LENGTH,
  NAME_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  signUpSchema,
  type SignUpInput,
} from "@docket/contracts";
import { useState, type FormEvent } from "react";

import { ApiError } from "@/shared/api/api-error";
import { Button } from "@/shared/components/Button";
import { TextField } from "@/shared/components/TextField";
import { toFieldErrors, type FieldErrors } from "@/shared/forms/field-errors";

import { useSignUp } from "../../hooks/useSignUp";
import formStyles from "../auth-form.module.css";
import styles from "./SignUpForm.module.css";

const FIELDS = ["name", "email", "password"] as const;
type Field = (typeof FIELDS)[number];

function readForm(form: HTMLFormElement): SignUpInput {
  const data = new FormData(form);
  return {
    name: String(data.get("name") ?? ""),
    email: String(data.get("email") ?? ""),
    password: String(data.get("password") ?? ""),
  };
}

export function SignUpForm() {
  const signUp = useSignUp();
  const [errors, setErrors] = useState<FieldErrors<Field>>({});
  const [formError, setFormError] = useState<string | null>(null);

  if (signUp.isSuccess) {
    return (
      <p className={styles.done} role="status">
        {signUp.data}
      </p>
    );
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    const parsed = signUpSchema.safeParse(readForm(event.currentTarget));
    if (!parsed.success) {
      const issues = parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      }));
      setErrors(toFieldErrors(issues, FIELDS));
      return;
    }

    setErrors({});
    signUp.mutate(parsed.data, {
      onError: (error) => {
        if (error instanceof ApiError && error.code === "VALIDATION_FAILED") {
          const issues = Array.isArray(error.details) ? error.details : [];
          setErrors(toFieldErrors(issues, FIELDS, "body."));
          return;
        }
        setFormError(
          error instanceof ApiError && error.code === "NETWORK_ERROR"
            ? "Could not reach the server. Check your connection."
            : "Your account could not be created. Try again.",
        );
      },
    });
  };

  return (
    <form className={formStyles.form} onSubmit={handleSubmit} noValidate>
      <TextField
        name="name"
        label="Name"
        autoComplete="name"
        maxLength={NAME_MAX_LENGTH}
        required
        error={errors.name}
      />
      <TextField
        name="email"
        type="email"
        label="Email"
        autoComplete="email"
        maxLength={EMAIL_MAX_LENGTH}
        required
        error={errors.email}
      />
      <TextField
        name="password"
        type="password"
        label="Password"
        hint={`At least ${PASSWORD_MIN_LENGTH} characters. A few unrelated words work well.`}
        autoComplete="new-password"
        maxLength={PASSWORD_MAX_LENGTH}
        required
        error={errors.password}
      />
      {formError && (
        <p className={formStyles.formError} role="alert">
          {formError}
        </p>
      )}
      <Button type="submit" variant="primary" busy={signUp.isPending} className={formStyles.submit}>
        {signUp.isPending ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}
