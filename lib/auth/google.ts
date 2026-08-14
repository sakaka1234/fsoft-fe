export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

/**
 * Where Google sends the reader back. Must match a URI registered in the Google
 * Console character for character, otherwise the consent screen fails with
 * redirect_uri_mismatch before anyone sees it. Only
 * http://localhost:3000/callback is registered today, so deploying means adding
 * the production origin there too.
 *
 * Note the path: /callback is ours, while /oauth2/callback is the backend
 * endpoint that trades the code for a session. They are different things.
 */
export function googleRedirectUri() {
  return `${window.location.origin}/callback`;
}

/** Authorization URL for the code flow. */
export function googleAuthorizeUrl() {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: googleRedirectUri(),
    response_type: "code",
    scope: "email profile openid",
    prompt: "select_account",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}
