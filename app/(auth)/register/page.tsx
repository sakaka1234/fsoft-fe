import type { Metadata } from "next";
import Link from "next/link";

import { AuthShell } from "@/components/auth/auth-shell";
import { RegisterForm } from "@/components/auth/register-form";
import { authArt } from "@/content/auth";

export const metadata: Metadata = {
  title: "Create your account",
  description:
    "Create an account and let AI build an English learning path around you.",
};

export default function RegisterPage() {
  return (
    <AuthShell
      title="Start learning free"
      lead="Create an account and the AI builds your path from your first assessment."
      art={authArt.register}
      footer={
        <>
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-accent-text underline underline-offset-4"
          >
            Sign in
          </Link>
        </>
      }
    >
      <RegisterForm />
    </AuthShell>
  );
}
