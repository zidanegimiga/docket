"use client";

import { useId, useState } from "react";

import { TextField, type TextFieldProps } from "../TextField";
import styles from "./PasswordField.module.css";

export type PasswordFieldProps = Omit<TextFieldProps, "type" | "end">;

/**
 * A password input with a button to show or hide what was typed. It always starts hidden. The
 * button's visible word is part of its accessible name, so speech users can say what they see.
 */
export function PasswordField({ id, ...rest }: PasswordFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [visible, setVisible] = useState(false);

  return (
    <TextField
      {...rest}
      id={inputId}
      type={visible ? "text" : "password"}
      // Shown as text, a password could otherwise be spell-checked, which some browsers do by
      // sending the field's contents to an online service.
      spellCheck={false}
      autoCapitalize="off"
      end={
        <button
          type="button"
          className={styles.toggle}
          aria-controls={inputId}
          aria-label={visible ? "Hide password" : "Show password"}
          onClick={() => setVisible((shown) => !shown)}
        >
          {visible ? "Hide" : "Show"}
        </button>
      }
    />
  );
}
