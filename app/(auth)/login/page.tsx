import type { Metadata } from "next";
import Link from "next/link";

import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { authArt } from "@/content/auth";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to continue your English learning path.",
};

export default function LoginPage() {
  return (
    <AuthShell
      title="Welcome back"
      lead="Sign in to pick up your path where you left it."
      art={authArt.login}
      footer={
        <>
          New here?{" "}
          <Link
            href="/register"
            className="font-medium text-accent-text underline underline-offset-4"
          >
            Create an account
          </Link>
        </>
      }
    >
      <LoginForm />
    </AuthShell>
  );
}
