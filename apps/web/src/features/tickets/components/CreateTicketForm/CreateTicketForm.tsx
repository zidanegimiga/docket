"use client";

import {
  createTicketSchema,
  DESCRIPTION_MAX_LENGTH,
  TICKET_PRIORITIES,
  TITLE_MAX_LENGTH,
  type CreateTicketInput,
} from "@docket/contracts";
import { useState, type FormEvent } from "react";

import { ApiError } from "@/shared/api/api-error";
import { Button } from "@/shared/components/Button";
import { Select } from "@/shared/components/Select";
import { TextArea } from "@/shared/components/TextArea";
import { TextField } from "@/shared/components/TextField";
import { toFieldErrors, type FieldErrors } from "@/shared/forms/field-errors";

import { useCreateTicket } from "../../hooks/useCreateTicket";
import { priorityLabels } from "../../labels";
import styles from "./CreateTicketForm.module.css";

const FIELDS = ["title", "description", "priority"] as const;
type Field = (typeof FIELDS)[number];

const priorityOptions = TICKET_PRIORITIES.map((value) => ({
  value,
  label: priorityLabels[value],
}));

function readForm(form: HTMLFormElement): CreateTicketInput {
  const data = new FormData(form);
  return {
    title: String(data.get("title") ?? ""),
    description: String(data.get("description") ?? ""),
    priority: data.get("priority") as CreateTicketInput["priority"],
  };
}

function failureMessage(error: unknown): string {
  if (error instanceof ApiError && error.code === "NETWORK_ERROR") {
    return "Could not reach the server. Check your connection and try again.";
  }
  const reference = error instanceof ApiError && error.requestId;
  return reference
    ? `The ticket could not be created. Reference: ${reference.slice(0, 8)}`
    : "The ticket could not be created.";
}

export function CreateTicketForm() {
  const createTicket = useCreateTicket();
  const [errors, setErrors] = useState<FieldErrors<Field>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<number | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    setFormError(null);
    setCreatedId(null);

    const parsed = createTicketSchema.safeParse(readForm(form));
    if (!parsed.success) {
      const issues = parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      }));
      setErrors(toFieldErrors(issues, FIELDS));
      return;
    }

    setErrors({});
    createTicket.mutate(parsed.data, {
      onSuccess: (ticket) => {
        form.reset();
        setCreatedId(ticket.id);
      },
      onError: (error) => {
        if (error instanceof ApiError && error.code === "VALIDATION_FAILED") {
          const issues = Array.isArray(error.details) ? error.details : [];
          setErrors(toFieldErrors(issues, FIELDS, "body."));
          return;
        }
        setFormError(failureMessage(error));
      },
    });
  };

  const handleInput = (event: FormEvent<HTMLFormElement>) => {
    const name = (event.target as HTMLInputElement).name as Field;
    if (errors[name]) setErrors(({ [name]: _cleared, ...rest }) => rest);
    setCreatedId(null);
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit} onInput={handleInput} noValidate>
      <TextField
        name="title"
        label="Title"
        maxLength={TITLE_MAX_LENGTH}
        autoComplete="off"
        required
        error={errors.title}
      />
      <TextArea
        name="description"
        label="Description"
        hint="Optional. Steps to reproduce, who is affected, anything already tried."
        maxLength={DESCRIPTION_MAX_LENGTH}
        error={errors.description}
      />
      <div className={styles.priority}>
        <Select
          name="priority"
          label="Priority"
          defaultValue="medium"
          options={priorityOptions}
          error={errors.priority}
        />
      </div>

      <div className={styles.actions}>
        <Button type="submit" variant="primary" busy={createTicket.isPending}>
          {createTicket.isPending ? "Creating…" : "Create ticket"}
        </Button>
        <p className={styles.feedback} role="status">
          {createdId !== null && `Ticket #${createdId} created.`}
        </p>
      </div>

      {formError && (
        <p className={styles.formError} role="alert">
          {formError}
        </p>
      )}
    </form>
  );
}
