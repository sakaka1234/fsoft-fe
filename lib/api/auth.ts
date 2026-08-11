import { apiFetch } from "@/lib/api/client";
import type {
  AuthenticatedResponse,
  LoginRequest,
  RegisterRequest,
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
