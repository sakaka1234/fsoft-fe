import { apiFetch } from "@/lib/api/client";
import type {
  AdminAiAuditLog,
  AdminAiChatHistoryMessage,
  AdminAiChatRequest,
  AdminAiChatResponse,
  PageResponse,
} from "@/lib/api/types";

/*
  Admin AI assistant endpoints.

  NOT YET DEPLOYED: verified live on 2026-09-08, every /admin/ai/* path on
  production answers 500 "No static resource admin/ai/chat..." while
  /admin/users answers 200 on the same server, so the controller simply is
  not there yet. The shapes below follow docs/swagger.json exactly; revisit
  the marked assumptions once the backend ships.

  Pagination on the two GET endpoints defaults page=1 in swagger, but this
  backend has shipped contradictory page bases before (decks are 1-based,
  pending-public is 0-based, pageable decks shift by one). Both GETs here
  send page as given, 1-based per the swagger default; if the live server
  turns out 0-based the fix is in these two functions only, the UI is
  unaffected.

  Confirm answers 462 when the actionId is unknown or already used and 463
  when it expired (5 minutes). Both arrive through apiFetch as ApiError with
  the server's message, which the UI surfaces verbatim.
*/

/** Ask the admin assistant a question; conversation persists per admin. */
export function adminAiChat(body: AdminAiChatRequest, signal?: AbortSignal) {
  return apiFetch<AdminAiChatResponse>("/admin/ai/chat", {
    method: "POST",
    body,
    auth: true,
    signal,
  });
}

/** Execute a drafted action. One actionId works exactly once. */
export function adminAiConfirm(actionId: string, signal?: AbortSignal) {
  return apiFetch<AdminAiChatResponse>("/admin/ai/chat/confirm", {
    method: "POST",
    body: { actionId },
    auth: true,
    signal,
  });
}

/** Cancel a drafted action; writes a CANCELLED audit log row. */
export function adminAiConfirmCancel(actionId: string, signal?: AbortSignal) {
  return apiFetch<AdminAiChatResponse>("/admin/ai/chat/confirm/cancel", {
    method: "POST",
    body: { actionId },
    auth: true,
    signal,
  });
}

/**
 * Chat history of the current admin. Swagger defaults page to 1, so the
 * caller's 0-based pages are shifted here; the UI passes 1-based pages.
 */
export function adminAiChatHistory(
  page = 1,
  size = 20,
  signal?: AbortSignal,
) {
  return apiFetch<AdminAiChatHistoryMessage[]>(
    `/admin/ai/chat/history?page=${page}&size=${size}`,
    { auth: true, signal },
  );
}

/** Clears this admin's chat thread. The next chat starts a new one. */
export function adminAiClearChatHistory(signal?: AbortSignal) {
  return apiFetch<void>("/admin/ai/chat/history", {
    method: "DELETE",
    auth: true,
    signal,
  });
}

/**
 * Audit trail of AI actions by the current admin, newest first. Swagger
 * defaults page to 1.
 */
export function adminAiAuditLogs(
  page = 1,
  size = 10,
  signal?: AbortSignal,
) {
  return apiFetch<PageResponse<AdminAiAuditLog>>(
    `/admin/ai/audit-logs?page=${page}&size=${size}`,
    { auth: true, signal },
  );
}