import {
  apiFetch,
  apiUpload,
  cardPageQuery,
  deckPageQuery,
} from "@/lib/api/client";
import type {
  DeckResponse,
  DeckShareResponse,
  DeckVisibility,
  DeckWriteRequest,
  PageResponse,
  PublicDeckQuery,
  SharePermission,
} from "@/lib/api/types";

/** Decks owned by the signed-in user. Page numbers start at 1. */
export function listMyDecks(page = 1, size = 12, signal?: AbortSignal) {
  return apiFetch<PageResponse<DeckResponse>>(
    `/decks/my${deckPageQuery(page, size)}`,
    { auth: true, signal },
  );
}

/** Decks shared with the signed-in user by others. Page numbers start at 1. */
export function listSharedWithMeDecks(page = 1, size = 12, signal?: AbortSignal) {
  return apiFetch<PageResponse<DeckResponse>>(
    `/decks/shared-with-me${deckPageQuery(page, size)}`,
    { auth: true, signal },
  );
}

/** Public catalogue, open to browsing and forking. Page numbers start at 1. */
export function listPublicDecks(
  { page = 1, size = 12, keyword, tagId, sourceLang, targetLang }: PublicDeckQuery,
  signal?: AbortSignal,
) {
  return apiFetch<PageResponse<DeckResponse>>(
    `/decks/public${deckPageQuery(page, size, { keyword, tagId, sourceLang, targetLang })}`,
    { auth: true, signal },
  );
}

/**
 * Every deck with this visibility, across all users. Verified live: with one
 * deck of my own, status=PUBLIC answered with six. So this cannot stand in for
 * "my decks by visibility"; count those from listMyDecks instead.
 */
export function listDecksByStatus(
  status: DeckVisibility,
  page = 1,
  size = 12,
  signal?: AbortSignal,
) {
  return apiFetch<PageResponse<DeckResponse>>(
    `/decks/status${deckPageQuery(page, size, { status })}`,
    { auth: true, signal },
  );
}

export function getDeck(id: number, signal?: AbortSignal) {
  return apiFetch<DeckResponse>(`/decks/${id}`, { auth: true, signal });
}

export function createDeck(request: DeckWriteRequest, coverImage?: File | null) {
  return apiUpload<DeckResponse>("/decks", { request, files: { coverImage } });
}

export function updateDeck(
  id: number,
  request: DeckWriteRequest,
  coverImage?: File | null,
) {
  return apiUpload<DeckResponse>(`/decks/${id}`, {
    method: "PUT",
    request,
    files: { coverImage },
  });
}

export function deleteDeck(id: number) {
  return apiFetch<void>(`/decks/${id}`, { method: "DELETE", auth: true });
}

/** Copies someone else's deck into your own list and returns the copy. */
export function forkDeck(id: number) {
  return apiFetch<DeckResponse>(`/decks/${id}/fork`, {
    method: "POST",
    auth: true,
  });
}

/**
 * Changes visibility on its own, without resending the whole deck.
 *
 * The OpenAPI document declares a DeckVisibilityRequest JSON body and the live
 * server enforces it: the query-string form now answers 400 with
 * "Required request body is missing". Requesting PUBLIC puts the deck in the
 * admin approval queue (pendingPublic) and it stays PRIVATE until approved.
 */
export function setDeckVisibility(id: number, visibility: DeckVisibility) {
  return apiFetch<void>(`/decks/${id}/visibility`, {
    method: "PUT",
    body: { visibility },
    auth: true,
  });
}

/*
  Sharing.

  A third pagination convention does not appear here, but the second one does,
  and not the one the rest of this file uses: /decks/{id}/shares binds Spring's
  Pageable and is ZERO based, like the card endpoints, while every other deck
  route on this page is ONE based. Verified live on a deck with a single share:
  page=0 answers pageNo=0 holding the row, page=1 answers pageNo=1 holding
  nothing. Reaching for deckPageQuery here would silently skip the first page.
*/

/** Grants someone access by email. They must already have an account. */
export function shareDeck(
  id: number,
  email: string,
  permission: SharePermission,
) {
  return apiFetch<void>(`/decks/${id}/share`, {
    method: "POST",
    body: { email, permission },
    auth: true,
  });
}

/** Who a deck is shared with. Zero based, see the note above. */
export function listDeckShares(
  id: number,
  page = 0,
  size = 20,
  signal?: AbortSignal,
) {
  return apiFetch<PageResponse<DeckShareResponse>>(
    `/decks/${id}/shares${cardPageQuery(page, size)}`,
    { auth: true, signal },
  );
}

/**
 * Promotes or demotes one recipient.
 *
 * permission travels in the query string, exactly like setDeckVisibility and
 * for the same reason. Verified live: a JSON body answers 400 "Miss argument
 * require: permission", the query form answers 200 and the change sticks on a
 * re-read.
 */
export function setSharePermission(
  id: number,
  profileId: string,
  permission: SharePermission,
) {
  return apiFetch<void>(
    `/decks/${id}/shares/${profileId}?permission=${encodeURIComponent(permission)}`,
    { method: "PUT", auth: true },
  );
}

/** Revokes one recipient's access. */
export function removeDeckShare(id: number, profileId: string) {
  return apiFetch<void>(`/decks/${id}/shares/${profileId}`, {
    method: "DELETE",
    auth: true,
  });
}

/**
 * Public share link, and it does not work yet on the server.
 *
 * Wired so the client is ready, but deliberately not surfaced in the UI. The
 * endpoint answers 200 and hands back a shareToken, yet shareLinkEnabled comes
 * back false every time. Verified by re-reading the deck itself rather than
 * trusting the toggle's own response: still false after three calls. With the
 * flag never set, getSharedDeck below can only ever 404, so a button for this
 * would be a control that visibly does nothing.
 */
export function toggleShareLink(id: number) {
  return apiFetch<DeckResponse>(`/decks/${id}/share-link/toggle`, {
    method: "POST",
    auth: true,
  });
}

/**
 * Opens a deck from a share token. Blocked by the bug above, and note it needs
 * a signed-in caller regardless: unauthenticated requests answer 401, so this
 * is a link for members, not a public one.
 */
export function getSharedDeck(shareToken: string, signal?: AbortSignal) {
  return apiFetch<DeckResponse>(`/decks/shared/${shareToken}`, {
    auth: true,
    signal,
  });
}
