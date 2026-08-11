import { Check } from "@phosphor-icons/react/Check";

import { cn } from "@/lib/cn";
import {
  PASSWORD_RULES,
  type PasswordStrength,
} from "@/lib/auth/password-policy";

type PasswordRequirementsProps = {
  id: string;
  strength: PasswordStrength;
};

/**
 * Live checklist under the password field.
 *
 * Only the summary line is a live region. Announcing five list items on every
 * keystroke would bury the field itself, so the list is static and reachable
 * through aria-describedby, while the one sentence that actually changed gets
 * spoken. Strength is carried by that word, never by the bar alone.
 */
export function PasswordRequirements({
  id,
  strength,
}: PasswordRequirementsProps) {
  return (
    <div id={id} className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div
          aria-hidden
          className="flex flex-1 gap-1"
          data-strength={strength.label}
        >
          {PASSWORD_RULES.map((rule, index) => (
            <span
              key={rule.id}
              className={cn(
                "h-1 flex-1 rounded-full transition-colors duration-200",
                index < strength.metCount ? "bg-accent" : "bg-line",
              )}
            />
          ))}
        </div>
        <p
          aria-live="polite"
          className={cn(
            "w-28 shrink-0 text-right text-sm",
            strength.isValid ? "text-accent-text" : "text-muted",
          )}
        >
          {strength.label}
        </p>
      </div>

      <ul className="flex flex-col gap-1.5">
        {PASSWORD_RULES.map((rule) => {
          const done = strength.met.has(rule.id);
          return (
            <li
              key={rule.id}
              className={cn(
                "flex items-center gap-2 text-sm transition-colors",
                done ? "text-ink" : "text-muted",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "flex size-4 shrink-0 items-center justify-center rounded-full transition-colors",
                  done ? "bg-accent text-accent-fg" : "border border-line",
                )}
              >
                {done ? <Check size={10} weight="bold" /> : null}
              </span>
              {rule.label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
