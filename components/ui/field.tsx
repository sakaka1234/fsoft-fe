import { cn } from "@/lib/cn";

type FieldProps = {
  id: string;
  label: string;
  /** Rendered below the label, above the control. Optional but kept in markup. */
  hint?: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
};

/**
 * Label above the control, hint under the label, error under the control.
 * Never a placeholder standing in for a label.
 */
export function Field({
  id,
  label,
  hint,
  error,
  className,
  children,
}: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      {hint ? (
        <p id={`${id}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** ComponentPropsWithRef, so callers can hold a ref (React 19 passes it as a
 *  normal prop, no forwardRef needed). */
type TextInputProps = React.ComponentPropsWithRef<"input"> & {
  invalid?: boolean;
};

/**
 * Contrast audit against --surface: text 15.9:1, placeholder --muted 5.1:1,
 * border --line visible in both themes, focus ring is the global accent
 * outline from globals.css.
 */
export function TextInput({ invalid, className, ...props }: TextInputProps) {
  return (
    <input
      {...props}
      aria-invalid={invalid || undefined}
      className={cn(CONTROL, invalid ? INVALID : VALID, "h-11", className)}
    />
  );
}

const CONTROL =
  "w-full rounded-field border bg-surface px-3.5 text-base text-ink placeholder:text-muted transition-colors disabled:cursor-not-allowed disabled:opacity-60";
const VALID = "border-line hover:border-ink/25";
const INVALID = "border-danger";

export function TextArea({
  invalid,
  className,
  ...props
}: React.ComponentPropsWithRef<"textarea"> & { invalid?: boolean }) {
  return (
    <textarea
      {...props}
      aria-invalid={invalid || undefined}
      className={cn(CONTROL, invalid ? INVALID : VALID, "py-2.5", className)}
    />
  );
}
