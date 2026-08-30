import { ApiError, apiFetch, apiUpload } from "@/lib/api/client";
import type {
  AiChatRequest,
  AiChatResponse,
  AiQuizRequest,
  AiQuizResponse,
  AiSearchResponse,
  AiAutoDeckRequest,
  AiAutoDeckResponse,
  AiRoleplayRequest,
  AiRoleplayResponse,
  AiRoleplayTurn,
  AiStoryRequest,
  AiStoryResponse,
  ExtractedCard,
  MagicSortRequest,
  MagicSortResult,
  SituationalLearningRequest,
  SituationalLearningResponse,
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
 * WORKING AGAIN. This answered 500 for every request for days; it now returns
 * grounded answers in about six seconds. It is proxied to a separate Python
 * service, so a missing field comes back in a FastAPI envelope
 * ({"detail":[...]}, HTTP 422) rather than this API's usual one, and a
 * business error comes back as {"error":{"code","message"}} at HTTP 400. Three
 * different error shapes on one endpoint, so surface ApiError.message and do
 * not parse the body yourself.
 *
 * Retrieval is scoped to the caller's OWN decks, injected server side, so an
 * admin does not see more than a normal user. Answers embed citation markers
 * like [#82] in the text.
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
 * WORKING AGAIN, and the deterministic path costs no model tokens: a plain
 * {deck_id} answers in under half a second with generated_by DETERMINISTIC and
 * zero prompt tokens.
 *
 * The deck needs at least four in-scope cards or it answers 400
 * {"error":{"code":"INVALID_REQUEST",...}}. Same three-error-shape caveat as
 * aiChat.
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
   - `deckId` no longer exists on these DTOs at all. It used to be accepted and
     dropped; now it is not in the schema either. Do not send it.
   - Latency ranges from 1.5s to 50s, median around 15s, and roughly one call
     in seven fails at ~47s with business status 434 "Lỗi trích xuất AI",
     which looks like an upstream timeout. Callers need a skeleton, not a
     spinner, and should treat a failure as retryable.
   - Extraction NOW WORKS. It answered empty on every probe for days, which is
     why the UI treats "succeeded, found nothing" as an ordinary outcome; keep
     that path, but real cards do come back today.
   - The element is ExtractedCard, NOT CardCreationRequest as the spec claims.
     Same eleven keys from all three endpoints, confirmed by key-diff.
   - imageUrl and audioUrl on those cards are model-fabricated and do not
     resolve. Never render them.
   - `deckId` was REMOVED from the request DTOs. It is now silently ignored,
     so extraction cannot target a deck; the caller decides where to save.
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
  return apiFetch<ExtractedCard[]>("/api/ai/extract/text", {
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
  return apiFetch<ExtractedCard[]>("/api/ai/extract/url", {
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
 * Unlike its siblings this takes `category` as a request parameter rather
 * than in a body. It is required; `deckId` is no longer part of this endpoint
 * at all.
 */
export function extractCardsFromFile(
  file: File,
  params: { category: string },
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

  const query = new URLSearchParams({ category: params.category });

  return apiUpload<ExtractedCard[]>(
    `/api/ai/extract/file?${query.toString()}`,
    { files: { file: withDeclaredType(file) }, auth: true, signal },
  );
}

/* ---------------------------------------------------------------------------
   Generation and roleplay.

   Shared with the extractors above: latency is unpredictable. Measured across
   real generations it ranged from about two seconds to well over a minute,
   with no relationship to input size. Two independent measurement runs
   disagreed by a factor of thirty on the same request, so the honest summary
   is "usually a few seconds, occasionally a very long stall". Callers get a
   generous timeout and a skeleton, never a countdown that pretends to know.
   --------------------------------------------------------------------------- */

/** Largest deck the generator will build. cardCount 31 already fails. */
export const AUTO_DECK_MAX_CARDS = 30;

/**
 * Generate a whole deck from a topic.
 *
 * NOTHING IS SAVED. The response says "Tạo bộ thẻ thành công" with body status
 * 201 and carries no deck id, and no deck exists afterwards. It is a preview;
 * persisting means creating a deck and posting each card.
 *
 * cardCount is required even though the spec and the guide both call it
 * optional with a default. It is a Java primitive int, so omitting it is a
 * guaranteed 400. Clamped here rather than trusting the caller, because
 * exceeding thirty fails after a long wait instead of erroring quickly.
 *
 * The two language fields are pure echo: omit them and they come back null.
 * They are sent by default so the response is self describing.
 */
export function aiAutoDeck(body: AiAutoDeckRequest, signal?: AbortSignal) {
  requireText(body.topic, "Topic");
  return apiFetch<AiAutoDeckResponse>("/api/ai/auto-deck", {
    method: "POST",
    body: {
      ...body,
      cardCount: Math.min(Math.max(1, Math.round(body.cardCount)), AUTO_DECK_MAX_CARDS),
      sourceLanguage: body.sourceLanguage ?? "en",
      targetLanguage: body.targetLanguage ?? "vi",
    },
    auth: true,
    signal,
  });
}

/**
 * The only contextType both the spec and the guide agree on.
 *
 * The spec offers BUSINESS_EMAIL, DAILY_STORY and NEWS_ARTICLE; the guide
 * offers BUSINESS_EMAIL, DAILY_NEWS and CASUAL_CHAT. Rather than guess which
 * list is real, the client offers only the value that appears in both.
 */
export const STORY_CONTEXT_TYPES = ["BUSINESS_EMAIL"] as const;

/**
 * Weave a set of words into a short text with a translation.
 *
 * Takes either literal words or card ids. Sending neither fails oddly: the
 * empty word list answers HTTP 400 carrying body status 403 and the message
 * "Invalid key", which reads like a permission problem and is not one. Guarded
 * here so nobody chases that.
 */
export function aiStory(body: AiStoryRequest, signal?: AbortSignal) {
  const hasWords = (body.words?.length ?? 0) > 0;
  const hasCards = (body.cardIds?.length ?? 0) > 0;
  if (!hasWords && !hasCards) {
    throw new ApiError("Pick at least one word to build the story from.", 400);
  }
  return apiFetch<AiStoryResponse>("/api/ai/story", {
    method: "POST",
    body,
    auth: true,
    signal,
  });
}

/** CEFR levels, required by the endpoint and absent from the written guide. */
export const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;

/**
 * Build a situational lesson: phrases for a real world scene.
 *
 * The path is /api/v1/ai/situational-learning/text. The guide's
 * /api/ai/situational-learning does not exist and answers the "No static
 * resource" flavour of 500.
 *
 * There is NO quiz in the response despite what the guide documents. The real
 * shape is five parallel lists of sentence pairs.
 *
 * A 200 whose lists are all empty means generation failed while the envelope
 * still claimed success, so callers must check emptiness rather than trusting
 * the status. situationalLessonIsEmpty exists for that.
 */
export function aiSituationalLearning(
  body: SituationalLearningRequest,
  signal?: AbortSignal,
) {
  requireText(body.context, "Situation");
  requireText(body.cefrLevel, "Level");
  return apiFetch<SituationalLearningResponse>(
    "/api/v1/ai/situational-learning/text",
    { method: "POST", body, auth: true, signal },
  );
}

/** True when the server said success but produced no content at all. */
export function situationalLessonIsEmpty(
  lesson: SituationalLearningResponse,
): boolean {
  return (
    lesson.mainActions.length === 0 &&
    lesson.interactions.length === 0 &&
    lesson.emotions.length === 0 &&
    lesson.shortCaptions.length === 0 &&
    lesson.vocabularies.length === 0
  );
}

/**
 * Longest conversation id the server stores.
 *
 * It truncates past this silently, so two ids sharing a 36 character prefix
 * become one conversation. Truncating here keeps the id the client holds equal
 * to the id the server holds.
 */
export const ROLEPLAY_ID_MAX = 36;

/** Roleplay scenarios the guide documents. The server accepts any string. */
export const ROLEPLAY_SCENARIOS = [
  "JOB_INTERVIEW",
  "DOCTOR_APPOINTMENT",
  "HOTEL_CHECKIN",
  "RESTAURANT",
] as const;

const clampConversationId = (id: string) => id.slice(0, ROLEPLAY_ID_MAX);

/**
 * One turn of the roleplay tutor.
 *
 * Omitting conversationId falls back to the caller's own user id, which is a
 * single shared conversation per account. Pass an explicit id for anything
 * that should be a separate thread.
 *
 * Conversations are NOT private: any authenticated caller who knows an id can
 * read its history. Do not put anything sensitive in one.
 */
export function aiRoleplay(body: AiRoleplayRequest, signal?: AbortSignal) {
  requireText(body.userMessage, "Message");
  return apiFetch<AiRoleplayResponse>("/api/ai/roleplay", {
    method: "POST",
    body: body.conversationId
      ? { ...body, conversationId: clampConversationId(body.conversationId) }
      : body,
    auth: true,
    signal,
  });
}

/** Past turns, oldest first. Omitting the id reads the account's default thread. */
export function aiRoleplayHistory(conversationId?: string, signal?: AbortSignal) {
  const query = conversationId
    ? `?conversationId=${encodeURIComponent(clampConversationId(conversationId))}`
    : "";
  return apiFetch<AiRoleplayTurn[]>(`/api/ai/roleplay/history${query}`, {
    auth: true,
    signal,
  });
}

/** Wipe a conversation's memory. Answers an envelope with no data key. */
export function aiRoleplayReset(conversationId: string, signal?: AbortSignal) {
  return apiFetch<void>(
    `/api/ai/roleplay/${encodeURIComponent(clampConversationId(conversationId))}`,
    { method: "DELETE", auth: true, signal },
  );
}

/**
 * Suggest a deck for each loose word.
 *
 * The request shape matches neither the spec nor the guide exactly; see
 * MagicSortRequest in lib/api/types.ts. `decks` is a map of deck id to name,
 * which is how the model is told what the options are, so passing it produces
 * far better suggestions than omitting it.
 */
export function aiMagicSort(body: MagicSortRequest, signal?: AbortSignal) {
  if (body.words.length === 0) {
    throw new ApiError("Give it at least one word to sort.", 400);
  }
  return apiFetch<MagicSortResult[]>("/api/ai/extract/magic-sort", {
    method: "POST",
    body,
    auth: true,
    signal,
  });
}

/*
  NOT WIRED, on purpose: GET /api/ai/extract/suggestions.

  It is the typeahead the guide describes for the card form, and it would be
  genuinely useful there. It is also broken: nine of nine calls answered HTTP
  500 "Something went wrong: Failed to read resource" in about 0.4s, with both
  a user and an admin token and five different queries. It never returned a
  successful body, so its response shape has never been seen and nothing here
  could be written against it honestly. See docs/backend-issues.md.
*/
