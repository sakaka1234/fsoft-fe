import type { Metadata } from "next";
import Link from "next/link";

import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { authArt } from "@/content/auth";

export const metadata: Metadata = {
  title: "Reset your password",
  description: "Send a one time code and choose a new password.",
};

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Reset your password"
      lead="We will email you a code, then you can pick a new password."
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
      <ForgotPasswordForm />
    </AuthShell>
  );
}
