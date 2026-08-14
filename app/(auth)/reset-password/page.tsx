import type { Metadata } from "next";
import Link from "next/link";

import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { authArt } from "@/content/auth";

export const metadata: Metadata = {
  title: "Set a new password",
};

/** Standalone entry for anyone who already has a code in hand. */
export default function ResetPasswordPage() {
  return (
    <AuthShell
      title="Set a new password"
      lead="Enter the code from your email along with the password you want to use."
      art={authArt.forgotPassword}
      footer={
        <>
          Remembered it?{" "}
          <Link
            href="/login"
            className="font-medium text-accent-text underline underline-offset-4"
          >
            Back to sign in
          </Link>
        </>
      }
    >
      <ResetPasswordForm />
    </AuthShell>
  );
}
