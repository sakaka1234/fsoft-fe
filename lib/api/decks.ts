import { apiFetch, apiUpload, pageQuery } from "@/lib/api/client";
import type {
  DeckResponse,
  DeckWriteRequest,
  PageResponse,
} from "@/lib/api/types";

export function listMyDecks(page = 0, size = 12, signal?: AbortSignal) {
  return apiFetch<PageResponse<DeckResponse>>(
    `/decks/my${pageQuery(page, size)}`,
    { auth: true, signal },
  );
}

export function listDecks(
  { page = 0, size = 12, tag }: { page?: number; size?: number; tag?: string },
  signal?: AbortSignal,
) {
  const query = pageQuery(page, size) + (tag ? `&tag=${encodeURIComponent(tag)}` : "");
  return apiFetch<PageResponse<DeckResponse>>(`/decks${query}`, {
    auth: true,
    signal,
  });
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
