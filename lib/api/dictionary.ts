import { ApiError, apiFetch } from "@/lib/api/client";
import type { DictionaryEntry } from "@/lib/api/types";

/*
  GET /api/dictionary/lookup is a verbatim passthrough of the Free Dictionary
  API (Wiktionary data). Everything below was established by 40+ live calls;
  none of it is guessed from the OpenAPI document, which describes the response
  only as "Object".

  Three behaviours drive the shape of this module:

  1. A word that is not in the dictionary answers HTTP 500, not 404 and not an
     empty list. Body is {"status":431,"message":"Lỗi tra từ điển"} with no
     data key at all. Every malformed-but-present value does the same: empty
     string, a space, digits, punctuation, Vietnamese text, an 80 character
     junk string. The only 400 is omitting the parameter entirely.
  2. Because of 1, a plain typo is indistinguishable from the upstream
     dictionary being down. isWordNotFound exists so callers stop reporting
     "the server is broken" every time someone misspells a word.
  3. data is an ARRAY of entries, one per etymology. "bank" answers four,
     "run" answers one. Reading data[0] and stopping loses meanings.

  Auth is required even though this is public reference data: with no
  Authorization header it answers 401. An ordinary account is enough, no role
  check was ever triggered.
*/

/**
 * Look a word up. Case insensitive, and phrases work ("take off").
 *
 * The `word` in each returned entry is upstream's normalised form, not what
 * was sent, so echo that back to the reader rather than their own input.
 *
 * Throws ApiError like every other call here. Run the failure through
 * isWordNotFound before showing it: a miss arrives as a 500.
 */
export function lookupWord(word: string, signal?: AbortSignal) {
  return apiFetch<DictionaryEntry[]>(
    `/api/dictionary/lookup?word=${encodeURIComponent(word)}`,
    { auth: true, signal },
  );
}

/**
 * True when the failure means "no such word" rather than "the service broke".
 *
 * There is no cleaner signal available. The endpoint answers HTTP 500 for a
 * miss and carries business status 431 in the body, but apiFetch keeps only
 * the message, so the message is what gets matched. If the backend ever starts
 * answering 404, add that here and the callers keep working.
 *
 * A real upstream outage also lands here and will be reported to the reader as
 * "no results". That is the better failure of the two: telling someone their
 * correctly spelled word broke the server is worse than telling them it was
 * not found.
 */
export function isWordNotFound(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.httpStatus === 500 &&
    error.message.includes("Lỗi tra từ điển")
  );
}

/**
 * First usable IPA for an entry.
 *
 * The top level `phonetic` is missing on roughly a fifth of entries, and
 * individual `phonetics[]` elements can lack `text`, so neither alone is
 * enough. Returns undefined when the entry carries no transcription at all.
 */
export function entryPhonetic(entry: DictionaryEntry): string | undefined {
  if (entry.phonetic) return entry.phonetic;
  return entry.phonetics.find((p) => p.text)?.text;
}

/**
 * First playable pronunciation URL, or undefined.
 *
 * `audio` is present on every element but is very often the empty string, so
 * truthiness is the test, not presence.
 */
export function entryAudio(entry: DictionaryEntry): string | undefined {
  return entry.phonetics.find((p) => p.audio)?.audio;
}
