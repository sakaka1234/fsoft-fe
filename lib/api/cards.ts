import { apiDownload, apiFetch, apiUpload, cardPageQuery } from "@/lib/api/client";
import type {
  CardPositionRequest,
  CardResponse,
  CardStarToggleResponse,
  CardWriteRequest,
  CramCardsResponse,
  PageResponse,
} from "@/lib/api/types";

/** Cards are zero based, unlike decks. See cardPageQuery in client.ts. */
export function listCards(
  deckId: number,
  page = 0,
  size = 50,
  signal?: AbortSignal,
) {
  return apiFetch<PageResponse<CardResponse>>(
    `/cards/deck/${deckId}${cardPageQuery(page, size)}`,
    { auth: true, signal },
  );
}

export function getCard(cardId: number, signal?: AbortSignal) {
  return apiFetch<CardResponse>(`/cards/${cardId}`, { auth: true, signal });
}

export function createCard(
  deckId: number,
  request: CardWriteRequest,
  files?: { imageFile?: File | null; audioFile?: File | null },
) {
  return apiUpload<CardResponse>(`/cards/deck/${deckId}`, { request, files });
}

export function updateCard(
  cardId: number,
  request: CardWriteRequest,
  files?: { imageFile?: File | null; audioFile?: File | null },
) {
  return apiUpload<CardResponse>(`/cards/${cardId}`, {
    method: "PUT",
    request,
    files,
  });
}

export function deleteCard(cardId: number) {
  return apiFetch<void>(`/cards/${cardId}`, { method: "DELETE", auth: true });
}

/** Sends the whole ordering, not just the moved card. */
export function reorderCards(deckId: number, positions: CardPositionRequest[]) {
  return apiFetch<void>(`/cards/deck/${deckId}/positions`, {
    method: "PUT",
    body: positions,
    auth: true,
  });
}

/* ---------------------------------------------------------------------------
   Stars, export, cram
   ------------------------------------------------------------------------- */

/**
 * Star or unstar a card.
 *
 * Returns the new state, and unlike two other toggles on this backend
 * (share-link/toggle and PATCH official) this one ACTUALLY FLIPS. Verified by
 * calling it twice and watching the starred list follow.
 *
 * Note the field name: `isStarred`, keeping the `is` prefix, where
 * DeckResponse drops it and answers `official`. The prefix behaviour is not
 * uniform across controllers, so it has to be checked per endpoint.
 */
export function toggleCardStar(cardId: number, signal?: AbortSignal) {
  return apiFetch<CardStarToggleResponse>(`/cards/${cardId}/toggle-star`, {
    method: "POST",
    auth: true,
    signal,
  });
}

/**
 * The caller's starred cards. Zero based paging, properly scoped to the caller.
 *
 * `sort` is deliberately not exposed. Sort keys resolve against the star join
 * entity rather than the card, so sort=word answers HTTP 500 and leaks the raw
 * JPQL in the error message. Only the default ordering is safe.
 *
 * There is no way to show star state on an ordinary card list: CardResponse
 * carries no starred flag, so a list would have to fetch this and intersect.
 */
export function listStarredCards(
  page = 0,
  size = 20,
  deckId?: number,
  signal?: AbortSignal,
) {
  const query = new URLSearchParams(cardPageQuery(page, size).slice(1));
  if (deckId !== undefined) query.set("deckId", String(deckId));
  return apiFetch<PageResponse<CardResponse>>(
    `/cards/starred?${query.toString()}`,
    { auth: true, signal },
  );
}

/**
 * Download a deck as a PDF.
 *
 * This is the only endpoint in the API that answers a file rather than the
 * JSON envelope, which is why it goes through apiDownload instead of
 * apiFetch: the latter parses every body as JSON and would choke on it.
 *
 * The Excel sibling exists at .../export/excel and is BROKEN server side. It
 * answers HTTP 500 with java.lang.NoClassDefFoundError on
 * sun.awt.X11FontManager, a headless JVM font problem, so it is not wired.
 * See docs/backend-issues.md.
 */
export function exportDeckPdf(deckId: number, signal?: AbortSignal) {
  return apiDownload(`/cards/deck/${deckId}/export/pdf`, signal);
}

/**
 * Every card in a deck with its SRS state, for a cram session.
 *
 * Unlike the SRS study queue this ignores scheduling and returns the whole
 * deck, which is what "cram before the exam" means.
 */
export function getCramCards(deckId: number, signal?: AbortSignal) {
  return apiFetch<CramCardsResponse>(`/decks/${deckId}/cram-cards`, {
    auth: true,
    signal,
  });
}
