import { ApiError, apiFetch, apiUpload, cardPageQuery } from "@/lib/api/client";
import type {
  AdminDashboardStats,
  AdminGameRecord,
  AdminUpdateDeckOfficialRequest,
  AdminUpdateUserRolesRequest,
  AdminUserResponse,
  CommunityPostResponse,
  DeckResponse,
  DeckVisibility,
  DeckVisibilityRequest,
  DeckWriteRequest,
  PageResponse,
  PostModerateRequest,
  TagRequest,
  TagResponse,
} from "@/lib/api/types";

/*
  Admin endpoints.

  Every endpoint here has been called live with a real admin token. The four
  read routes answer 200 and their payloads match the types in
  lib/api/types.ts. The write routes were exercised against a throwaway deck
  that was created and deleted for the purpose, never against real data.

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
  if (!(error instanceof ApiError)) return false;
  if (error.httpStatus === 403) return true;
  return error.httpStatus === 500 && isAccessDeniedMessage(error.message);
}

/**
 * The same test against a bare message.
 *
 * useAsync hands components the message rather than the ApiError, so screens
 * cannot use isAccessDenied. Without this they would each hard code the magic
 * string, and the string is the only signal there is, so it should live in one
 * place.
 */
export function isAccessDeniedMessage(message: string): boolean {
  return message.includes("Access Denied");
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

  Since confirmed directly with an admin token: page=0 answers pageNo=0 and
  page=1 answers pageNo=1 with a different slice of users. Zero based, settled.
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
 * Role strings seen live: "USER" and "ADMIN", both bare, with no ROLE_ prefix
 * on this side. Sending an unknown name has not been tested, and the server
 * does not validate the role filter elsewhere, so assume it will not validate
 * here either.
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
 *
 * BROKEN SERVER SIDE. This answers 200 and does not change anything. Verified
 * on a throwaway deck: read official=false, PATCH {"isOfficial":true} answers
 * 200 whose own body still says official=false, and re-reading the deck still
 * says false. Same shape of bug as share-link/toggle. Callers should compare
 * the returned flag against what they sent and tell the reader the truth
 * rather than showing an optimistic success; admin-view.tsx does that.
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

/* ---------------------------------------------------------------------------
   Tags.

   These MOVED here. The ordinary /tags controller lost its update and delete
   routes: PUT /tags/{id} and DELETE /tags/{id} now answer the "No static
   resource" flavour of 500, i.e. they are gone. Only GET /tags and POST /tags
   remain for ordinary users, so renaming and deleting a tag is now an admin
   action. lib/api/tags.ts documents the same thing from the other side.
   ------------------------------------------------------------------------- */

/** Every tag. Takes no pagination at all, unlike most admin lists. */
export function listAdminTags(signal?: AbortSignal) {
  return apiFetch<TagResponse[]>("/admin/tags", { auth: true, signal });
}

export function createAdminTag(body: TagRequest, signal?: AbortSignal) {
  return apiFetch<TagResponse>("/admin/tags", {
    method: "POST",
    body,
    auth: true,
    signal,
  });
}

export function renameAdminTag(
  id: number,
  body: TagRequest,
  signal?: AbortSignal,
) {
  return apiFetch<TagResponse>(`/admin/tags/${id}`, {
    method: "PUT",
    body,
    auth: true,
    signal,
  });
}

/** Answers an envelope with no data key on success. */
export function deleteAdminTag(id: number, signal?: AbortSignal) {
  return apiFetch<void>(`/admin/tags/${id}`, {
    method: "DELETE",
    auth: true,
    signal,
  });
}

/* ------------------------- public deck moderation ------------------------- */

/**
 * Decks waiting to be approved as public.
 *
 * Paging here does NOT behave like the other admin lists. Sending page=N
 * answers pageNo=N+1, checked across three consecutive values, so the number
 * in the response is one ahead of the number sent. Send zero based, and never
 * render pageNo directly.
 */
export function listPendingPublicDecks(
  page = 0,
  size = 20,
  signal?: AbortSignal,
) {
  return apiFetch<PageResponse<DeckResponse>>(
    `/admin/decks/pending-public?page=${page}&size=${size}`,
    { auth: true, signal },
  );
}

/**
 * Approve or reject a deck's public listing.
 *
 * `approved` is a REQUIRED query parameter, not a body field, which is unlike
 * every other write in this file.
 */
export function approvePublicDeck(
  deckId: number,
  approved: boolean,
  signal?: AbortSignal,
) {
  return apiFetch<DeckResponse>(
    `/admin/decks/${deckId}/approve-public?approved=${approved}`,
    { method: "PATCH", auth: true, signal },
  );
}

/* ----------------------------- deck visibility ---------------------------- */

/**
 * Flip a deck's visibility between PUBLIC and PRIVATE.
 *
 * Body: { visibility: "PUBLIC" | "PRIVATE" }
 * Response: the updated DeckResponse.
 */
export function setDeckVisibility(
  deckId: number,
  body: DeckVisibilityRequest,
  signal?: AbortSignal,
) {
  return apiFetch<DeckResponse>(`/admin/decks/${deckId}/visibility`, {
    method: "PUT",
    body,
    auth: true,
    signal,
  });
}

/* ----------------------- community post moderation ----------------------- */

/**
 * List community posts awaiting moderation.
 *
 * Uses plain 0-based page/size query params (not Spring Pageable).
 */
export function listPendingCommunityPosts(
  page = 0,
  size = 20,
  signal?: AbortSignal,
) {
  return apiFetch<PageResponse<CommunityPostResponse>>(
    `/community-posts/admin/pending?page=${page}&size=${size}`,
    { auth: true, signal },
  );
}

/**
 * Approve or reject a community post.
 *
 * status: "APPROVED" | "REJECTED"
 * reason: required when rejecting, ignored when approving.
 */
export function moderateCommunityPost(
  postId: number,
  body: PostModerateRequest,
  signal?: AbortSignal,
) {
  return apiFetch<CommunityPostResponse>(
    `/community-posts/admin/${postId}/moderate`,
    { method: "PUT", body, auth: true, signal },
  );
}
