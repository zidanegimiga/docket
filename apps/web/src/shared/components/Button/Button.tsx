import type { ComponentProps } from "react";

import styles from "./Button.module.css";

interface ButtonProps extends ComponentProps<"button"> {
  variant?: "primary" | "secondary";
  busy?: boolean;
}

/** Classes for a link that should look like a button. */
export function buttonClassName(variant: ButtonProps["variant"] = "secondary"): string {
  return [styles.button, variant === "primary" && styles.primary].filter(Boolean).join(" ");
}

export function Button({
  variant = "secondary",
  busy = false,
  type = "button",
  disabled,
  className,
  ...rest
}: ButtonProps) {
  const classes = [buttonClassName(variant), className].filter(Boolean).join(" ");

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      {...rest}
    />
  );
}
