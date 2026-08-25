import { ApiError, apiFetch, apiUpload, cardPageQuery } from "@/lib/api/client";
import type {
  AdminDashboardStats,
  AdminGameRecord,
  AdminUpdateDeckOfficialRequest,
  AdminUpdateUserRolesRequest,
  AdminUserResponse,
  DeckResponse,
  DeckVisibility,
  DeckWriteRequest,
  PageResponse,
} from "@/lib/api/types";

/*
  Admin endpoints.

  Everything here was probed live with an ordinary ROLE_USER token. No admin
  token was available, so the request side (paths, parameter names, casing,
  binding) is verified and the response side is the OpenAPI document's word.
  Anything below marked "unverified" has never been seen.

  TWO FACTS THAT SHAPE THIS WHOLE FILE:

  1. These routes live at /admin/... with NO /api prefix. That is the opposite
     of the AI group. Verified: /api/admin/dashboard/stats answers
     "No static resource", /admin/dashboard/stats answers "Access Denied".

  2. THIS API NEVER RETURNS 403. Spring's AccessDeniedException is wrapped by
     a global handler into HTTP 500 with message
     "Something went wrong: Access Denied", and a route that does not exist is
     wrapped into HTTP 500 with message "No static resource <path>". The status
     code cannot distinguish "you lack the role" from "that endpoint is gone"
     from "the server genuinely broke". Only the message can, which is what
     isAccessDenied and isMissingRoute below are for.

     Callers must use them. An admin screen that reads httpStatus === 403 will
     never fire, and one that treats 500 as an outage will tell a non admin
     that the server is down.

  Validation runs BEFORE authorization on this backend, which is the only
  reason the request shapes here could be confirmed at all: a malformed body
  answers 400 naming the real field even to a caller who would have been
  denied anyway.
*/

/**
 * True when the failure was an authorization refusal rather than a fault.
 *
 * Matched on the message because the status code carries no information here;
 * see the note above. If the backend is ever fixed to answer a real 403, add
 * that check here and every caller keeps working unchanged.
 */
export function isAccessDenied(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.httpStatus === 403 ||
      (error.httpStatus === 500 && error.message.includes("Access Denied")))
  );
}

/**
 * True when the path itself does not exist on the server.
 *
 * Worth distinguishing from the above: it means this client and the backend
 * have drifted apart, which is a deploy problem, not a permissions one.
 */
export function isMissingRoute(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.httpStatus === 500 &&
    error.message.includes("No static resource")
  );
}

/*
  Pagination. The admin list routes bind a Spring Pageable rather than the flat
  one-based page/size that the deck routes use, so they take the ZERO based
  cardPageQuery, not deckPageQuery.

  Evidence: page=abc is tolerated on /admin/users, /admin/decks and
  /admin/games/records, falling through to the authorization refusal, whereas
  every genuinely typed parameter on these same routes (isOfficial, visibility,
  userId, deckId) answers a type-conversion 400 for a bad value. Silent
  tolerance of a non-numeric page is the signature of
  PageableHandlerMethodArgumentResolver, which is zero based by default.

  Caveat worth keeping: the base index was inferred from the binding mechanism,
  not observed in a payload, because authorization never let a body through. If
  an admin ever sees page 1 repeated at the start of a list, this is the first
  place to look.
*/

/* --------------------------------- users --------------------------------- */

/**
 * `keyword` and `role` are plain strings, not validated enums: a nonsense
 * role passes binding and reaches the authorization check, so the server does
 * no filtering on the value's shape.
 */
export function listAdminUsers(
  page: number,
  size: number,
  filters: { keyword?: string; role?: string } = {},
  signal?: AbortSignal,
) {
  const query = new URLSearchParams(cardPageQuery(page, size).slice(1));
  if (filters.keyword) query.set("keyword", filters.keyword);
  if (filters.role) query.set("role", filters.role);
  return apiFetch<PageResponse<AdminUserResponse>>(
    `/admin/users?${query.toString()}`,
    { auth: true, signal },
  );
}

/** userId is a UUID. A malformed one answers a type-conversion 400. */
export function getAdminUser(userId: string, signal?: AbortSignal) {
  return apiFetch<AdminUserResponse>(`/admin/users/${userId}`, {
    auth: true,
    signal,
  });
}

/**
 * Replace a user's roles.
 *
 * `roleNames` is camelCase, confirmed: role_names is accepted and silently
 * dropped, which would clear every role rather than erroring.
 *
 * The valid role strings are not discoverable without admin access. The only
 * one ever observed is "USER", from the register response. Sending an unknown
 * name has not been tested.
 */
export function updateAdminUserRoles(
  userId: string,
  body: AdminUpdateUserRolesRequest,
  signal?: AbortSignal,
) {
  return apiFetch<AdminUserResponse>(`/admin/users/${userId}/roles`, {
    method: "PUT",
    body,
    auth: true,
    signal,
  });
}

/* --------------------------------- decks --------------------------------- */

/**
 * `isOfficial` here is camelCase and really is spelled that way on the query,
 * confirmed by a bad value naming isOfficial in the 400. Passing `official`
 * is silently ignored and returns everything.
 *
 * `visibility` is a strict enum: a bad value answers 400.
 */
export function listAdminDecks(
  page: number,
  size: number,
  filters: {
    keyword?: string;
    isOfficial?: boolean;
    visibility?: DeckVisibility;
  } = {},
  signal?: AbortSignal,
) {
  const query = new URLSearchParams(cardPageQuery(page, size).slice(1));
  if (filters.keyword) query.set("keyword", filters.keyword);
  if (filters.isOfficial !== undefined) {
    query.set("isOfficial", String(filters.isOfficial));
  }
  if (filters.visibility) query.set("visibility", filters.visibility);
  return apiFetch<PageResponse<DeckResponse>>(
    `/admin/decks?${query.toString()}`,
    { auth: true, signal },
  );
}

/**
 * Create a deck as an admin.
 *
 * Multipart with the same part names the ordinary deck create uses: a JSON
 * part literally called "request", plus an optional "coverImage".
 *
 * DeckWriteRequest already carries the isOfficial spelling this needs, and
 * already documents that the flag is a primitive boolean server side, so
 * leaving it out is a 500 rather than a default.
 */
export function createAdminDeck(
  request: DeckWriteRequest,
  coverImage?: File | null,
  signal?: AbortSignal,
) {
  return apiUpload<DeckResponse>("/admin/decks", {
    request,
    files: { coverImage },
    auth: true,
    signal,
  });
}

/**
 * Flip a deck's official flag.
 *
 * The read/write asymmetry is live and confirmed here rather than assumed:
 * PATCH with {"official":true} answers 400 "isOfficial flag is required",
 * while decks read back carrying `official` and never `isOfficial`. So a
 * round trip has to translate the name in both directions.
 */
export function setDeckOfficial(
  deckId: number,
  body: AdminUpdateDeckOfficialRequest,
  signal?: AbortSignal,
) {
  return apiFetch<DeckResponse>(`/admin/decks/${deckId}/official`, {
    method: "PATCH",
    body,
    auth: true,
    signal,
  });
}

/** Hard delete. Answers ApiResponseVoid, so there is no payload. */
export function deleteAdminDeck(deckId: number, signal?: AbortSignal) {
  return apiFetch<void>(`/admin/decks/${deckId}`, {
    method: "DELETE",
    auth: true,
    signal,
  });
}

/* ----------------------------- game records ------------------------------ */

/**
 * `deckId` here is a Long, not a UUID, confirmed by the type-conversion 400.
 * `gameType` is a plain string with no server side validation.
 */
export function listAdminGameRecords(
  page: number,
  size: number,
  filters: { gameType?: string; deckId?: number } = {},
  signal?: AbortSignal,
) {
  const query = new URLSearchParams(cardPageQuery(page, size).slice(1));
  if (filters.gameType) query.set("gameType", filters.gameType);
  if (filters.deckId !== undefined) query.set("deckId", String(filters.deckId));
  return apiFetch<PageResponse<AdminGameRecord>>(
    `/admin/games/records?${query.toString()}`,
    { auth: true, signal },
  );
}

/** recordId is a string id, not numeric. */
export function deleteAdminGameRecord(recordId: string, signal?: AbortSignal) {
  return apiFetch<void>(`/admin/games/records/${recordId}`, {
    method: "DELETE",
    auth: true,
    signal,
  });
}

/* ------------------------------- dashboard ------------------------------- */

/** Six counters. Takes no parameters. */
export function getAdminDashboardStats(signal?: AbortSignal) {
  return apiFetch<AdminDashboardStats>("/admin/dashboard/stats", {
    auth: true,
    signal,
  });
}
