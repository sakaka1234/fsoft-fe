/**
 * Password policy for the signup form.
 *
 * Heads up: the API only enforces "at least 8 characters" (verified against
 * the live endpoint, which accepts `12345678`). Everything below that is a
 * client-side guardrail, so anyone posting straight to /auth/register can
 * still create a weak password. The backend has to grow the same rules for
 * this to be an actual policy rather than a suggestion.
 */
export type PasswordRule = {
  id: string;
  label: string;
  test: (value: string) => boolean;
};

export const PASSWORD_RULES: PasswordRule[] = [
  {
    id: "length",
    label: "At least 8 characters",
    test: (value) => value.length >= 8,
  },
  {
    id: "lowercase",
    label: "One lowercase letter",
    test: (value) => /[a-z]/.test(value),
  },
  {
    id: "uppercase",
    label: "One uppercase letter",
    test: (value) => /[A-Z]/.test(value),
  },
  {
    id: "number",
    label: "One number",
    test: (value) => /\d/.test(value),
  },
  {
    id: "special",
    // Anything that is not a letter, a digit, or whitespace.
    label: "One special character, such as ! ? @ or #",
    test: (value) => /[^\p{L}\p{N}\s]/u.test(value),
  },
];

export type PasswordStrength = {
  met: ReadonlySet<string>;
  metCount: number;
  isValid: boolean;
  /** Shown as text so strength never depends on color alone. */
  label: "Too short" | "Weak" | "Almost there" | "Strong";
};

export function evaluatePassword(value: string): PasswordStrength {
  const met = new Set(
    PASSWORD_RULES.filter((rule) => rule.test(value)).map((rule) => rule.id),
  );
  const metCount = met.size;

  let label: PasswordStrength["label"] = "Weak";
  if (value.length === 0 || !met.has("length")) label = "Too short";
  else if (metCount === PASSWORD_RULES.length) label = "Strong";
  else if (metCount >= 3) label = "Almost there";

  return {
    met,
    metCount,
    isValid: metCount === PASSWORD_RULES.length,
    label,
  };
}
