export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

/**
 * Where Google sends the reader back. Must match a URI registered in the Google
 * Console character for character, otherwise the consent screen fails with
 * redirect_uri_mismatch before anyone sees it.
 *
 * This is built from window.location.origin, so it follows whatever port the
 * dev server runs on. The dev server moved to 4000, which means
 * http://localhost:4000/callback has to be added to the Google Console
 * alongside the 3000 entry that was registered first, and the production
 * origin when that exists. Nothing in this repo can do that for you.
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
