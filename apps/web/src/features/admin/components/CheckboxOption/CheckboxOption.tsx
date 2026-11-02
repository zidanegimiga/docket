import { useId } from "react";

import styles from "./CheckboxOption.module.css";

interface CheckboxOptionProps {
  name: string;
  value: string;
  label: string;
  hint?: string | null | undefined;
  defaultChecked: boolean;
  disabled?: boolean;
}

/** The label names the checkbox; the hint is linked as its description, not part of its name. */
export function CheckboxOption({
  name,
  value,
  label,
  hint,
  defaultChecked,
  disabled,
}: CheckboxOptionProps) {
  const id = useId();
  const hintId = `${id}-hint`;

  return (
    <div className={styles.option}>
      <input
        id={id}
        type="checkbox"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        disabled={disabled}
        aria-describedby={hint ? hintId : undefined}
      />
      <div>
        <label htmlFor={id} className={styles.name}>
          {label}
        </label>
        {hint && (
          <span id={hintId} className={styles.hint}>
            {hint}
          </span>
        )}
      </div>
    </div>
  );
}
