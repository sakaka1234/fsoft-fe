"use client";

import { useState } from "react";
import { Eye } from "@phosphor-icons/react/Eye";
import { EyeSlash } from "@phosphor-icons/react/EyeSlash";

import { TextInput } from "@/components/ui/field";
import { cn } from "@/lib/cn";

type PasswordInputProps = Omit<
  React.ComponentPropsWithRef<"input">,
  "type"
> & {
  invalid?: boolean;
};

/**
 * Password field with a reveal control.
 *
 * The button is type="button" so it never submits the form, carries a label
 * that names the action rather than the state, and reports aria-pressed so a
 * screen reader can tell whether the password is currently exposed. It sits
 * inside the field, and the input reserves padding for it so long values
 * never run underneath.
 */
export function PasswordInput({
  className,
  disabled,
  ...props
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <TextInput
        {...props}
        disabled={disabled}
        type={visible ? "text" : "password"}
        className={cn("pr-12", className)}
      />
      <button
        type="button"
        onClick={() => setVisible((value) => !value)}
        aria-pressed={visible}
        aria-label={visible ? "Hide password" : "Show password"}
        title={visible ? "Hide password" : "Show password"}
        disabled={disabled}
        className="absolute top-1/2 right-1.5 flex size-9 -translate-y-1/2 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-ink disabled:cursor-not-allowed disabled:opacity-60"
      >
        {visible ? (
          <EyeSlash aria-hidden size={18} />
        ) : (
          <Eye aria-hidden size={18} />
        )}
      </button>
    </div>
  );
}
