import { ApiError, apiFetch, apiUpload } from "@/lib/api/client";
import type {
  AiChatRequest,
  AiChatResponse,
  AiQuizRequest,
  AiQuizResponse,
  AiSearchResponse,
  CardCreationRequest,
  TextExtractionRequest,
  UrlExtractionRequest,
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

/* ---------------------------------------------------------------------------
   Extraction: turn source material into draft cards.

   These three sit behind the same /api/ai prefix as the calls above but use
   camelCase bodies, not snake_case. Getting that wrong does not error: the
   controller ignores unknown properties, so deck_id is accepted, dropped, and
   deckId arrives null. See the note in lib/api/types.ts.

   Shared behaviour, all established live:

   - `category` is required despite the spec marking it optional. Omitting it
     is an unguarded server NPE (HTTP 500 "Something went wrong: null") that
     returns in under half a second, before any model call. The source field
     (`text` / `url`) is required the same way. Both are guarded here so the
     reader gets a real message instead of a 500.
   - `deckId` is accepted and then ignored. A nonexistent id, another user's
     deck, and no id at all all answer 200 identically. It is still sent when
     given, because the field is real and may start working.
   - Latency ranges from 1.5s to 50s, median around 15s, and roughly one call
     in seven fails at ~47s with business status 434 "Lỗi trích xuất AI",
     which looks like an upstream timeout. Callers need a skeleton, not a
     spinner, and should treat a failure as retryable.
   - Every probe so far answered 200 with an EMPTY array, across prose, word
     lists, single words, several categories and a real deck. The endpoints
     work; the extraction behind them currently produces nothing. UI has to
     handle "succeeded, found nothing" as an ordinary outcome.
   --------------------------------------------------------------------------- */

/** Thrown before the network when a required field is missing or blank. */
function requireText(value: string, field: string) {
  if (!value.trim()) {
    throw new ApiError(`${field} is required.`, 400);
  }
}

/**
 * Draft cards from a block of prose or a word list.
 *
 * Empty text is not rejected by the server: it answers 200 with [] after
 * about ten seconds, having spent a model call on nothing. Guarded here.
 */
export function extractCardsFromText(
  body: TextExtractionRequest,
  signal?: AbortSignal,
) {
  requireText(body.text, "Text");
  requireText(body.category, "Category");
  return apiFetch<CardCreationRequest[]>("/api/ai/extract/text", {
    method: "POST",
    body,
    auth: true,
    signal,
  });
}

/**
 * Draft cards from a web page.
 *
 * A dead link, a non-http string and a missing category all fail the same
 * way: HTTP 500 carrying business status 433 "Lỗi đọc URL". The message
 * therefore cannot tell the reader which of those went wrong, so validate the
 * obvious cases before sending.
 */
export function extractCardsFromUrl(
  body: UrlExtractionRequest,
  signal?: AbortSignal,
) {
  requireText(body.url, "URL");
  requireText(body.category, "Category");
  return apiFetch<CardCreationRequest[]>("/api/ai/extract/url", {
    method: "POST",
    body,
    auth: true,
    signal,
  });
}

/**
 * Largest file the server accepts. 1,048,000 bytes was taken and 1,100,000
 * was rejected, sometimes by aborting the connection mid-upload, so this is
 * checked before sending rather than after.
 */
export const EXTRACTION_MAX_FILE_BYTES = 1_000_000;

/**
 * Content types the extractor dispatches on, mapped from file extension.
 *
 * This map exists because of a real server bug. File type dispatch reads the
 * multipart part's declared Content-Type and never the filename, and a
 * browser File whose `type` is empty serialises as application/octet-stream.
 * The same valid PDF bytes answer 200 when declared application/pdf and blow
 * up with a raw java.lang.NoSuchMethodError from PDFBox when declared
 * octet-stream. So the type has to be asserted here, not left to the browser.
 */
const EXTRACTION_MIME_BY_EXTENSION: Record<string, string> = {
  txt: "text/plain",
  md: "text/plain",
  csv: "text/plain",
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
};

/** Extensions the server was seen to handle. Used for the file picker filter. */
export const EXTRACTION_ACCEPT = Object.keys(EXTRACTION_MIME_BY_EXTENSION)
  .map((extension) => `.${extension}`)
  .join(",");

/**
 * Re-wrap a File so its Content-Type is one the server dispatches on.
 *
 * Returns the original when the browser already set a usable type, so a file
 * picked normally is not copied for nothing.
 */
function withDeclaredType(file: File): File {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const wanted = EXTRACTION_MIME_BY_EXTENSION[extension];
  if (!wanted || file.type === wanted) return file;
  return new File([file], file.name, { type: wanted });
}

/**
 * Draft cards from an uploaded document.
 *
 * Unlike its siblings this takes category and deckId as request parameters
 * rather than in a body, and both are genuinely required here: omitting
 * deckId answers 400 "Miss argument require: deckId". They are sent in the
 * query string, though the server binds them from multipart fields equally.
 *
 * The response shape is unconfirmed. Every upload answered 200 with an empty
 * array, so no element has ever been seen.
 */
export function extractCardsFromFile(
  file: File,
  params: { category: string; deckId: number },
  signal?: AbortSignal,
) {
  requireText(params.category, "Category");
  if (file.size > EXTRACTION_MAX_FILE_BYTES) {
    throw new ApiError(
      `That file is ${Math.round(file.size / 1024)} KB. The server accepts up to ${Math.round(
        EXTRACTION_MAX_FILE_BYTES / 1024,
      )} KB.`,
      400,
    );
  }

  const query = new URLSearchParams({
    category: params.category,
    deckId: String(params.deckId),
  });

  return apiUpload<CardCreationRequest[]>(
    `/api/ai/extract/file?${query.toString()}`,
    { files: { file: withDeclaredType(file) }, auth: true, signal },
  );
}
