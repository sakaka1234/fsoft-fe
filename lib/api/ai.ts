import { apiFetch } from "@/lib/api/client";
import type {
  AiChatRequest,
  AiChatResponse,
  AiQuizRequest,
  AiQuizResponse,
  AiSearchResponse,
} from "@/lib/api/types";

/*
  The AI controller sits behind an /api prefix that no other route in this API
  uses. Verified live: /fsoft/api/ai/search answers 200, /fsoft/ai/search
  answers 500 "No static resource ai/search". Its request and response bodies
  are snake_case while the rest of the API is camelCase; see the note in
  lib/api/types.ts before "tidying" any of these field names.
*/

/**
 * Grounded question answering over cards, returning citations.
 *
 * Pass scope_deck_id to keep retrieval inside one deck. The server holds no
 * conversation state, so history has to be resent on every turn.
 *
 * Known backend failure at the time of writing: every call answers HTTP 500
 * with body status 429 "Lỗi hỏi đáp AI", including one with an empty body,
 * which puts the fault upstream of request validation rather than in the shape
 * sent from here. Callers should surface ApiError.message rather than assume
 * their input was wrong.
 */
export function aiChat(body: AiChatRequest, signal?: AbortSignal) {
  return apiFetch<AiChatResponse>("/api/ai/chat", {
    method: "POST",
    body,
    auth: true,
    signal,
  });
}

/**
 * Generates quiz questions from a deck or an explicit card list.
 *
 * Same backend failure as aiChat: HTTP 500 with body status 430 "Lỗi sinh bài
 * tập AI", and it fails with use_ai_context false too, so the deterministic
 * path is out as well.
 */
export function aiQuiz(body: AiQuizRequest, signal?: AbortSignal) {
  return apiFetch<AiQuizResponse>("/api/ai/quiz", {
    method: "POST",
    body,
    auth: true,
    signal,
  });
}

/**
 * Card search.
 *
 * Two things it does not do, both verified live rather than assumed:
 *
 * 1. It does not search the caller's own cards. Four cards created seconds
 *    earlier were invisible to it, so the index appears to cover seeded
 *    content only.
 * 2. It is not semantic despite the name. "deadline" matched with
 *    match_type EXACT, while "work schedule" and "talking to coworkers"
 *    matched nothing, with the words commute and colleague sitting in the
 *    deck.
 *
 * It also returned a card from a deck this caller cannot open: GET /decks/2
 * and GET /cards/201 both answer 404 for the same token that got the hit.
 */
export function aiSearch(query: string, signal?: AbortSignal) {
  return apiFetch<AiSearchResponse>(
    `/api/ai/search?query=${encodeURIComponent(query)}`,
    { auth: true, signal },
  );
}
