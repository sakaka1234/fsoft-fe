import { apiFetch } from "@/lib/api/client";
import type {
  AuthenticatedResponse,
  LoginRequest,
  RegisterRequest,
  ResetPasswordRequest,
  UserResponse,
} from "@/lib/api/types";

export function login(body: LoginRequest, signal?: AbortSignal) {
  return apiFetch<AuthenticatedResponse>("/auth/login", {
    method: "POST",
    body,
    signal,
  });
}

export function register(body: RegisterRequest, signal?: AbortSignal) {
  return apiFetch<UserResponse>("/auth/register", {
    method: "POST",
    body,
    signal,
  });
}

/** Invalidates the access token server side. Errors are the caller's to ignore. */
export function logout(accessToken: string) {
  return apiFetch<string>("/auth/logout", {
    method: "POST",
    body: { accessToken },
  });
}

/**
 * Mails a one time code.
 *
 * Answers 200 "Gửi mã OTP thành công" whether or not the address belongs to an
 * account, which is the right call: it stops anyone probing the API to find out
 * who is registered. The UI has to match that and never claim the account was
 * found.
 */
export function forgotPassword(email: string, signal?: AbortSignal) {
  return apiFetch<string>("/auth/forgot-password", {
    method: "POST",
    body: { email },
    signal,
  });
}

export function resetPassword(body: ResetPasswordRequest, signal?: AbortSignal) {
  return apiFetch<string>("/auth/reset-password", {
    method: "POST",
    body,
    signal,
  });
}

/**
 * Trades the Google authorization code for a session. The code comes back on
 * our own /callback route, which is the redirect URI registered with Google.
 */
export function loginWithGoogle(code: string, signal?: AbortSignal) {
  return apiFetch<AuthenticatedResponse>(
    `/oauth2/callback?code=${encodeURIComponent(code)}`,
    { method: "POST", signal },
  );
}

/**
 * Asks the server whether a token is still valid, without using it to call
 * anything. Useful for preflight checks before starting flows that must not
 * fail halfway; cheap enough to call before a sensitive action.
 */
export function introspectToken(token: string, signal?: AbortSignal) {
  return apiFetch<{ result: boolean }>("/auth/introspect", {
    method: "POST",
    body: { token },
    signal,
  });
}
