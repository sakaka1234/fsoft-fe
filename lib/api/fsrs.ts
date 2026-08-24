import { apiFetch } from "@/lib/api/client";
import type {
  ReviewCardResponse,
  SrsRating,
  SrsReviewRequest,
} from "@/lib/api/types";

export function getFsrsStudyQueue(
  deckId?: number,
  earlyBufferMinutes = 120,
  clusterMinutes = 30,
  signal?: AbortSignal,
) {
  const query = new URLSearchParams();
  if (deckId !== undefined && deckId !== null) {
    query.set("deckId", String(deckId));
  }
  if (earlyBufferMinutes !== undefined) {
    query.set("earlyBufferMinutes", String(earlyBufferMinutes));
  }
  if (clusterMinutes !== undefined) {
    query.set("clusterMinutes", String(clusterMinutes));
  }

  const queryString = query.toString() ? `?${query.toString()}` : "";
  return apiFetch<ReviewCardResponse[]>(`/srs/study-queue${queryString}`, {
    auth: true,
    signal,
  });
}

/**
 * rating is 1 Again, 2 Hard, 3 Good, 4 Easy. Narrowed from number so a stray
 * 0 or 5 is a compile error rather than a 400 at runtime; the server rejects
 * anything outside that range with a field error on `rating`.
 */
export function reviewFsrsCard(cardId: number, rating: SrsRating) {
  const body: SrsReviewRequest = { cardId, rating };
  return apiFetch<ReviewCardResponse>("/srs/review", {
    method: "POST",
    body,
    auth: true,
  });
}

/**
 * Clears every card's schedule in one deck, back to NEW at easiness 2.5.
 *
 * Verified live: answers 200 and a re-read of the queue shows all four cards
 * at NEW with easinessFactor 2.5. Lived in lib/api/srs.ts before that module
 * was folded into this one; the two were calling the same two endpoints.
 */
export function resetDeckSrs(deckId: number) {
  return apiFetch<void>(`/srs/deck/${deckId}/reset`, {
    method: "DELETE",
    auth: true,
  });
}
