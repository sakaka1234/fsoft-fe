"use client";

import { useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { ButtonLink } from "@/components/ui/button-link";
import { Spinner } from "@/components/ui/spinner";
import { FormMessage } from "@/components/auth/form-message";
import { loginWithGoogle } from "@/lib/api/auth";
import { startSession } from "@/lib/auth/session-store";
import { useAsync } from "@/lib/use-async";

type GoogleCallbackProps = {
  code?: string;
  /** Google sends this instead of a code when consent is declined. */
  error?: string;
};

export function GoogleCallback({ code, error }: GoogleCallbackProps) {
  const router = useRouter();

  const exchange = useAsync(
    useCallback(
      async (signal: AbortSignal) => {
        if (!code) throw new Error("missing code");
        const result = await loginWithGoogle(code, signal);
        startSession({ user: result.user, token: result.token });
        router.replace("/dashboard");
        return result;
      },
      [code, router],
    ),
    `google:${code ?? "none"}`,
  );

  // Google declined before we ever got a code, so there is nothing to trade.
  if (error || !code) {
    return (
      <Panel>
        <FormMessage>
          {error === "access_denied"
            ? "Google sign in was cancelled."
            : "Google did not send an authorization code."}
        </FormMessage>
        <ButtonLink href="/login">Back to sign in</ButtonLink>
      </Panel>
    );
  }

  if (exchange.status === "error") {
    return (
      <Panel>
        <FormMessage>{exchange.error}</FormMessage>
        <ButtonLink href="/login">Back to sign in</ButtonLink>
      </Panel>
    );
  }

  return (
    <Panel>
      <div className="flex flex-col items-center gap-4 text-center">
        <Spinner size={36} label="Signing you in" />
        <div className="flex flex-col gap-1">
          <p className="text-base font-medium text-ink">
            Signing you in with Google
          </p>
          <p className="text-sm text-muted">
            This takes a moment, you will land on your dashboard shortly.
          </p>
        </div>
        <Link
          href="/login"
          className="text-sm font-medium text-accent-text underline underline-offset-4"
        >
          Cancel
        </Link>
      </div>
    </Panel>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-start gap-5">
      {children}
    </div>
  );
}
