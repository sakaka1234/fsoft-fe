import { apiFetch } from "@/lib/api/client";
import type {
  SrsCardResponse,
  SrsRating,
  SrsReviewRequest,
} from "@/lib/api/types";

/**
 * Cards due for review.
 *
 * deckId is optional in the contract and required in practice: omitting it
 * answers 200 with an empty array rather than every deck's queue. Verified
 * live against an account holding four due cards.
 *
 * Cards are enrolled automatically on creation, arriving as status NEW with
 * easinessFactor 2.5 and a null nextReviewDate, so nothing needs initialising
 * before a first session.
 */
export function getStudyQueue(
  deckId: number,
  limit = 20,
  signal?: AbortSignal,
) {
  return apiFetch<SrsCardResponse[]>(
    `/srs/study-queue?deckId=${deckId}&limit=${limit}`,
    { auth: true, signal },
  );
}

/**
 * Grades one card and returns its rescheduled state.
 *
 * rating is 1 Again, 2 Hard, 3 Good, 4 Easy. Established by grading four
 * identical NEW cards one level each: 1 reset repetitions to 0, cut easiness
 * from 2.5 to 1.96 and scheduled the card for the same day, while 2, 3 and 4
 * advanced to the next day at easiness 2.18, 2.36 and 2.50. Anything outside
 * 1 to 4 answers 400 with a field error on `rating`.
 */
export function reviewCard(cardId: number, rating: SrsRating) {
  const body: SrsReviewRequest = { cardId, rating };
  return apiFetch<SrsCardResponse>("/srs/review", {
    method: "POST",
    body,
    auth: true,
  });
}

/** Clears every card's schedule in one deck, back to NEW at easiness 2.5. */
export function resetDeckSrs(deckId: number) {
  return apiFetch<void>(`/srs/deck/${deckId}/reset`, {
    method: "DELETE",
    auth: true,
  });
}
