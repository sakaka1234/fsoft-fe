"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { FormMessage } from "@/components/auth/form-message";
import { PasswordRequirements } from "@/components/auth/password-requirements";
import { login, register } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { evaluatePassword } from "@/lib/auth/password-policy";
import { startSession } from "@/lib/auth/session-store";

/**
 * The register endpoint spells the password field `passWord` and returns
 * validation errors under that key, so map it back to the input's own name
 * before showing anything.
 */
const SERVER_FIELD_TO_INPUT: Record<string, string> = {
  passWord: "password",
};

function normalizeFieldErrors(errors: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(errors).map(([key, message]) => [
      SERVER_FIELD_TO_INPUT[key] ?? key,
      message,
    ]),
  );
}

export function RegisterForm() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const phoneRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const strength = evaluatePassword(password);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    // Checked here rather than by disabling the button: a button that cannot
    // be pressed never explains why. Pressing it points at what is missing.
    const nextErrors: Record<string, string> = {};

    /*
      Phone is optional in the API contract, but the register endpoint has a
      duplicate check that reads roughly `existsByEmailOrPhone(email, phone)`.
      A null phone turns the phone half into `phone IS NULL`, which matches any
      existing row without a phone, so a brand new email comes back as
      "Email or Phone already exists". Verified against the live API: same
      email, no phone -> 400, unique phone -> 201.
      Remove this rule once the backend checks the phone only when it has one.
    */
    if (!phone.trim()) nextErrors.phone = "Enter your phone number.";
    if (!strength.isValid) {
      nextErrors.password = "Password does not meet all the requirements yet.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      (nextErrors.phone ? phoneRef : passwordRef).current?.focus();
      return;
    }

    setPending(true);

    try {
      await register({
        fullName,
        email,
        phone: phone.trim(),
        passWord: password,
      });
    } catch (error) {
      if (error instanceof ApiError) {
        setFormError(error.message);
        setFieldErrors(normalizeFieldErrors(error.fieldErrors));
      } else {
        setFormError("Something went wrong. Please try again.");
      }
      setPending(false);
      return;
    }

    // The account exists now. Signing in is a second call, so a failure here
    // is not a failed signup: say so and send them to the sign in page.
    try {
      const result = await login({ email, password });
      startSession({ user: result.user, token: result.token });
      router.replace("/decks");
    } catch {
      router.replace("/login");
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {formError ? <FormMessage>{formError}</FormMessage> : null}

      <Field id="fullName" label="Full name" error={fieldErrors.fullName}>
        <TextInput
          id="fullName"
          name="fullName"
          autoComplete="name"
          required
          minLength={4}
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          invalid={Boolean(fieldErrors.fullName)}
          aria-describedby={fieldErrors.fullName ? "fullName-error" : undefined}
          disabled={pending}
        />
      </Field>

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

      <Field id="phone" label="Phone" error={fieldErrors.phone}>
        <TextInput
          ref={phoneRef}
          id="phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          required
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          invalid={Boolean(fieldErrors.phone)}
          aria-describedby={fieldErrors.phone ? "phone-error" : undefined}
          disabled={pending}
        />
      </Field>

      <Field id="password" label="Password" error={fieldErrors.password}>
        <PasswordInput
          ref={passwordRef}
          id="password"
          name="password"
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
        {pending ? "Creating account" : "Create account"}
      </Button>
    </form>
  );
}
