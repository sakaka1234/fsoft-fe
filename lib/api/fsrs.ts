import { apiFetch } from "@/lib/api/client";
import type { ReviewCardResponse, SrsReviewRequest } from "@/lib/api/types";

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

export function reviewFsrsCard(cardId: number, rating: number) {
  const body: SrsReviewRequest = { cardId, rating };
  return apiFetch<ReviewCardResponse>("/srs/review", {
    method: "POST",
    body,
    auth: true,
  });
}
