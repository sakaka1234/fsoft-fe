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

  Verified live 2026-09-08 against production:

  - Both GET endpoints are truly ONE based. page=0 clamps to page 1 and the
    response echoes pageNo=1, so a 0-based UI page must shift by +1 here.
  - History answers a plain chronological array (oldest first), not a
    PageResponse; hydrate the thread in order.
  - Confirm answers HTTP 400 with envelope status 462 for an unknown or
    already used actionId, and 463 once the 5 minute window lapses; both
    surface here as ApiError.message. Execution results come back in
    AdminAiChatResponse.result.
  - A non admin token is refused with HTTP 403 "You do not have permission
    to perform this action"; isAccessDeniedMessage covers it.

  The bot answers from live system data through Groq function calling. A
  dangerous action (approve/reject/delete deck, official flag, role change)
  arrives as pendingAction and is NOT executed until /confirm runs; cancel
  writes a CANCELLED audit row, and business violations (e.g. approving a
  deck that is not pending) execute as FAILED audit rows with a 460 error.
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
 * Chat history of the current admin, oldest first, plain array. The UI's
 * 0-based pages shift to the server's 1-based pages here.
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
 * Audit trail of AI actions by the current admin, newest first. One-based
 * pages, verified live: page=0 clamps to page 1.
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