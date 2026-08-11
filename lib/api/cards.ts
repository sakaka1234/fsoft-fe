import { apiFetch, apiUpload, pageQuery } from "@/lib/api/client";
import type {
  CardPositionRequest,
  CardResponse,
  CardWriteRequest,
  PageResponse,
} from "@/lib/api/types";

export function listCards(
  deckId: number,
  page = 0,
  size = 50,
  signal?: AbortSignal,
) {
  return apiFetch<PageResponse<CardResponse>>(
    `/cards/deck/${deckId}${pageQuery(page, size)}`,
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
