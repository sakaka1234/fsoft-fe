import type { Metadata } from "next";

import { Container } from "@/components/ui/container";
import { GoogleCallback } from "@/components/auth/google-callback";

export const metadata: Metadata = {
  title: "Signing you in",
};

/**
 * The redirect URI registered with Google. It has to stay at /callback: the
 * backend endpoint that trades the code lives at /oauth2/callback, and mixing
 * the two up means Google refuses the request before the page ever loads.
 *
 * searchParams is a promise here, which makes this route dynamic. That is
 * correct: the code differs on every sign in and must never be cached.
 */
export default async function CallbackPage({
  searchParams,
}: PageProps<"/callback">) {
  const { code, error } = await searchParams;

  return (
    <Container>
      <GoogleCallback
        code={typeof code === "string" ? code : undefined}
        error={typeof error === "string" ? error : undefined}
      />
    </Container>
  );
}
