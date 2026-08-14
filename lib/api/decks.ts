import { apiFetch, apiUpload, deckPageQuery } from "@/lib/api/client";
import type {
  DeckResponse,
  DeckVisibility,
  DeckWriteRequest,
  PageResponse,
  PublicDeckQuery,
} from "@/lib/api/types";

/** Decks owned by the signed-in user. Page numbers start at 1. */
export function listMyDecks(page = 1, size = 12, signal?: AbortSignal) {
  return apiFetch<PageResponse<DeckResponse>>(
    `/decks/my${deckPageQuery(page, size)}`,
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
 * The value goes in the query string even though the OpenAPI document declares
 * a DeckVisibilityRequest body. Verified live: a JSON body answers 400 and the
 * error shows the server writing `visibility=null`, because the controller
 * reads a request parameter that was never sent. The query form answers 200.
 */
export function setDeckVisibility(id: number, visibility: DeckVisibility) {
  return apiFetch<void>(
    `/decks/${id}/visibility?visibility=${encodeURIComponent(visibility)}`,
    { method: "PUT", auth: true },
  );
}
