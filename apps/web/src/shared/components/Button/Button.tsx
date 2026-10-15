import type { ComponentProps } from "react";

import styles from "./Button.module.css";

interface ButtonProps extends ComponentProps<"button"> {
  variant?: "primary" | "secondary";
  busy?: boolean;
}

export function Button({
  variant = "secondary",
  busy = false,
  type = "button",
  disabled,
  className,
  ...rest
}: ButtonProps) {
  const classes = [styles.button, variant === "primary" && styles.primary, className]
    .filter(Boolean)
    .join(" ");

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
