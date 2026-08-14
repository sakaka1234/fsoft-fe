"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/field";
import { FormMessage } from "@/components/auth/form-message";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { forgotPassword } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";

/**
 * Two steps on one route, so the address never has to travel through a query
 * string to reach the second form, and nobody retypes it.
 */
export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    if (!email.trim()) {
      setFormError("Enter the email you signed up with.");
      return;
    }

    setPending(true);
    try {
      await forgotPassword(email.trim());
      setSent(true);
    } catch (error) {
      setFormError(
        error instanceof ApiError
          ? error.message
          : "Something went wrong. Please try again.",
      );
      setPending(false);
    }
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-6">
        {/*
          The API answers the same way whether or not the address has an
          account, which keeps anyone from probing it for registered emails.
          The wording has to hold that line: never confirm the account exists.
        */}
        <p className="rounded-field border border-line bg-surface-2 px-4 py-3 text-sm leading-relaxed text-ink">
          If {email.trim()} has an account, a code is on its way. Enter it below
          along with your new password.
        </p>
        <ResetPasswordForm defaultEmail={email.trim()} />
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {formError ? <FormMessage>{formError}</FormMessage> : null}

      <Field id="forgot-email" label="Email">
        <TextInput
          id="forgot-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={pending}
        />
      </Field>

      <Button type="submit" size="lg" disabled={pending} className="mt-2 w-full">
        {pending ? "Sending" : "Send code"}
      </Button>
    </form>
  );
}
