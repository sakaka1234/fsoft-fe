"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle } from "@phosphor-icons/react/CheckCircle";

import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { Field, TextInput } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { FormMessage } from "@/components/auth/form-message";
import { PasswordRequirements } from "@/components/auth/password-requirements";
import { resetPassword } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { evaluatePassword } from "@/lib/auth/password-policy";

/** Same key mapping as signup: the API names the field `newPassword`. */
const SERVER_FIELD_TO_INPUT: Record<string, string> = {
  newPassword: "password",
};

function normalizeFieldErrors(errors: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(errors).map(([key, message]) => [
      SERVER_FIELD_TO_INPUT[key] ?? key,
      message,
    ]),
  );
}

export function ResetPasswordForm({
  defaultEmail = "",
}: {
  defaultEmail?: string;
}) {
  const [email, setEmail] = useState(defaultEmail);
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const passwordRef = useRef<HTMLInputElement>(null);
  const strength = evaluatePassword(password);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    // Same policy as signup, checked before the request so a weak password
    // never costs a round trip or burns the one time code.
    if (!strength.isValid) {
      setFieldErrors({
        password: "Password does not meet all the requirements yet.",
      });
      passwordRef.current?.focus();
      return;
    }

    setPending(true);
    try {
      await resetPassword({ email, otp: otp.trim(), newPassword: password });
      setDone(true);
    } catch (error) {
      if (error instanceof ApiError) {
        setFormError(error.message);
        setFieldErrors(normalizeFieldErrors(error.fieldErrors));
      } else {
        setFormError("Something went wrong. Please try again.");
      }
      setPending(false);
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-start gap-4 rounded-card border border-line bg-surface p-6">
        <CheckCircle
          aria-hidden
          size={26}
          weight="duotone"
          className="text-accent-text"
        />
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            Password changed
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            Sign in with your new password.
          </p>
        </div>
        <ButtonLink href="/login">Sign in</ButtonLink>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {formError ? <FormMessage>{formError}</FormMessage> : null}

      <Field id="reset-email" label="Email" error={fieldErrors.email}>
        <TextInput
          id="reset-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          invalid={Boolean(fieldErrors.email)}
          disabled={pending}
        />
      </Field>

      <Field
        id="reset-otp"
        label="Code from your email"
        hint="Check your inbox for the message we just sent."
        error={fieldErrors.otp}
      >
        <TextInput
          id="reset-otp"
          inputMode="numeric"
          autoComplete="one-time-code"
          required
          value={otp}
          onChange={(event) => setOtp(event.target.value)}
          invalid={Boolean(fieldErrors.otp)}
          disabled={pending}
          className="font-mono tracking-[0.2em]"
        />
      </Field>

      <Field id="password" label="New password" error={fieldErrors.password}>
        <PasswordInput
          ref={passwordRef}
          id="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          invalid={Boolean(fieldErrors.password)}
          aria-describedby={
            fieldErrors.password
              ? "password-error password-requirements"
              : "password-requirements"
          }
          disabled={pending}
        />
        <PasswordRequirements id="password-requirements" strength={strength} />
      </Field>

      <Button type="submit" size="lg" disabled={pending} className="mt-2 w-full">
        {pending ? "Saving" : "Set new password"}
      </Button>

      <p className="text-sm text-muted">
        No code yet?{" "}
        <Link
          href="/forgot-password"
          className="font-medium text-accent-text underline underline-offset-4"
        >
          Send another
        </Link>
      </p>
    </form>
  );
}
