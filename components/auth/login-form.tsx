"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { FormMessage } from "@/components/auth/form-message";
import { GoogleButton } from "@/components/auth/google-button";
import { login } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { startSession } from "@/lib/auth/session-store";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setFormError(null);
    setFieldErrors({});

    try {
      const result = await login({ email, password });
      startSession({ user: result.user, token: result.token });
      // Left pending on purpose: the button stays disabled through the
      // navigation instead of flicking back to enabled first.
      router.replace("/dashboard");
    } catch (error) {
      if (error instanceof ApiError) {
        setFormError(error.message);
        setFieldErrors(error.fieldErrors);
      } else {
        setFormError("Something went wrong. Please try again.");
      }
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <GoogleButton label="Sign in with Google" />

      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        {formError ? <FormMessage>{formError}</FormMessage> : null}

        <Field id="email" label="Email" error={fieldErrors.email}>
          <TextInput
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            invalid={Boolean(fieldErrors.email)}
            aria-describedby={fieldErrors.email ? "email-error" : undefined}
            disabled={pending}
          />
        </Field>

        <Field id="password" label="Password" error={fieldErrors.password}>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            invalid={Boolean(fieldErrors.password)}
            aria-describedby={
              fieldErrors.password ? "password-error" : undefined
            }
            disabled={pending}
          />
        </Field>

        <Button
          type="submit"
          size="lg"
          disabled={pending}
          className="mt-2 w-full"
        >
          {pending ? "Signing in" : "Sign in"}
        </Button>

        <p className="text-sm text-muted">
          <Link
            href="/forgot-password"
            className="font-medium text-accent-text underline underline-offset-4"
          >
            Forgot your password?
          </Link>
        </p>
      </form>
    </div>
  );
}
