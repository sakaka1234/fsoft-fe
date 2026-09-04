"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, TextArea, TextInput } from "@/components/ui/field";
import { FormMessage } from "@/components/auth/form-message";
import { ApiError } from "@/lib/api/client";
import { aiVocabLookup } from "@/lib/api/ai";
import type { CardResponse, CardWriteRequest, VocabLookupResponse } from "@/lib/api/types";
import { Trash } from "@phosphor-icons/react/Trash";
import { MagicWand } from "@phosphor-icons/react/MagicWand";

type CardFiles = { imageFile?: File | null; audioFile?: File | null };

/**
 * Outcome of a dictionary lookup, as a state rather than a pile of booleans,
 * so the four results that need different wording cannot be rendered at once.
 */
type LookupState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "filled"; fields: string[]; entry: string; alreadyInDeck?: boolean; existingCardId?: number | null }
  | { kind: "nothing-to-fill"; entry: string; alreadyInDeck?: boolean; existingCardId?: number | null }
  | { kind: "empty" }
  | { kind: "suggestion"; word: string; suggestion: string }
  | { kind: "error"; message: string };

type CardFormProps = {
  deckId?: number;
  card?: CardResponse;
  onSubmit: (request: CardWriteRequest, files: CardFiles) => Promise<unknown>;
  onCancel: () => void;
  submitLabel: string;
};

export function CardForm({
  deckId,
  card,
  onSubmit,
  onCancel,
  submitLabel,
}: CardFormProps) {
  const [word, setWord] = useState(card?.word ?? "");
  const [meaning, setMeaning] = useState(card?.meaning ?? "");
  const [phonetic, setPhonetic] = useState(card?.phonetic ?? "");
  const [partOfSpeech, setPartOfSpeech] = useState(card?.partOfSpeech ?? "");
  const [definitionEn, setDefinitionEn] = useState(card?.definitionEn ?? "");
  const [exampleSentence, setExampleSentence] = useState(
    card?.exampleSentence ?? "",
  );
  const [exampleMeaning, setExampleMeaning] = useState(
    card?.exampleMeaning ?? "",
  );
  const [note, setNote] = useState(card?.note ?? "");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);

  const imagePreviewUrl = useMemo(() => {
    if (!imageFile) return null;
    return URL.createObjectURL(imageFile);
  }, [imageFile]);

  const audioPreviewUrl = useMemo(() => {
    if (!audioFile) return null;
    return URL.createObjectURL(audioFile);
  }, [audioFile]);

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
      if (audioPreviewUrl) {
        URL.revokeObjectURL(audioPreviewUrl);
      }
    };
  }, [imagePreviewUrl, audioPreviewUrl]);

  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [lookupState, setLookupState] = useState<LookupState>({ kind: "idle" });
  const [aiLookupPending, setAiLookupPending] = useState(false);

  async function handleAiLookup(overrideTerm?: string) {
    const termToUse = (overrideTerm ?? word).trim();
    if (!termToUse || aiLookupPending) return;

    if (overrideTerm) {
      setWord(overrideTerm);
    }

    setAiLookupPending(true);
    setLookupState({ kind: "loading" });
    try {
      const res = await aiVocabLookup({
        word: termToUse,
        context: exampleSentence.trim() || undefined,
        allowed_deck_ids: deckId ? [deckId] : undefined,
      });

      if (!res.found) {
        if (res.suggestion) {
          setLookupState({
            kind: "suggestion",
            word: termToUse,
            suggestion: res.suggestion,
          });
        } else {
          setLookupState({
            kind: "error",
            message: `Không tìm thấy thông tin từ vựng "${termToUse}".`,
          });
        }
        return;
      }

      if (res.card) {
        const filled: string[] = [];
        if (res.card.meaning) {
          setMeaning(res.card.meaning);
          filled.push("meaning (Nghĩa VI)");
        }
        if (res.card.phonetic) {
          setPhonetic(res.card.phonetic);
          filled.push("phonetic");
        }
        if (res.card.part_of_speech) {
          setPartOfSpeech(res.card.part_of_speech);
          filled.push("part of speech");
        }
        if (res.card.definition_en) {
          setDefinitionEn(res.card.definition_en);
          filled.push("definition");
        }
        if (res.card.example_sentence) {
          setExampleSentence(res.card.example_sentence);
          filled.push("example");
        }
        if (res.card.example_meaning) {
          setExampleMeaning(res.card.example_meaning);
          filled.push("example meaning");
        }

        setLookupState(
          filled.length > 0
            ? {
                kind: "filled",
                fields: filled,
                entry: `${res.card.word} (${res.source})`,
                alreadyInDeck: res.card.already_in_deck,
                existingCardId: res.card.existing_card_id,
              }
            : {
                kind: "nothing-to-fill",
                entry: `${res.card.word} (${res.source})`,
                alreadyInDeck: res.card.already_in_deck,
                existingCardId: res.card.existing_card_id,
              },
        );
      }
    } catch (err) {
      setLookupState({
        kind: "error",
        message: err instanceof ApiError ? err.message : "Không thể kết nối AI Lookup service.",
      });
    } finally {
      setAiLookupPending(false);
    }
  }

  // Live typing debounced lookup (fsoft-ai)
  const [liveLookup, setLiveLookup] = useState<VocabLookupResponse | null>(null);

  useEffect(() => {
    const term = word.trim();
    if (term.length < 2) {
      setLiveLookup(null);
      return;
    }
    const timer = setTimeout(() => {
      aiVocabLookup({
        word: term,
        allowed_deck_ids: deckId ? [deckId] : undefined,
      })
        .then((res) => {
          setLiveLookup(res);
        })
        .catch(() => setLiveLookup(null));
    }, 400);
    return () => clearTimeout(timer);
  }, [word, deckId]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const nextErrors: Record<string, string> = {};
    if (!word.trim()) nextErrors.word = "Enter the word.";
    if (!meaning.trim()) nextErrors.meaning = "Enter what it means.";
    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      return;
    }

    setPending(true);
    try {
      await onSubmit(
        {
          word: word.trim(),
          meaning: meaning.trim(),
          phonetic: phonetic.trim() || undefined,
          partOfSpeech: partOfSpeech.trim() || undefined,
          definitionEn: definitionEn.trim() || undefined,
          exampleSentence: exampleSentence.trim() || undefined,
          exampleMeaning: exampleMeaning.trim() || undefined,
          note: note.trim() || undefined,
          position: card?.position,
        },
        { imageFile, audioFile },
      );
    } catch (error) {
      if (error instanceof ApiError) {
        setFormError(error.message);
        setFieldErrors(error.fieldErrors);
      } else {
        setFormError("Something went wrong. Please try again.");
      }
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="flex flex-col gap-5 rounded-card border border-line bg-surface p-6"
    >
      {formError ? <FormMessage>{formError}</FormMessage> : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="card-word" label="Word" error={fieldErrors.word}>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <TextInput
                id="card-word"
                value={word}
                onChange={(event) => {
                  setWord(event.target.value);
                  if (lookupState.kind !== "idle") {
                    setLookupState({ kind: "idle" });
                  }
                }}
                invalid={Boolean(fieldErrors.word)}
                disabled={pending}
                required
                className="flex-1"
              />
              <button
                type="button"
                onClick={() => handleAiLookup()}
                disabled={
                  pending || !word.trim() || lookupState.kind === "loading" || aiLookupPending
                }
                title="Tự động điền đầy đủ Nghĩa Tiếng Việt, ví dụ và định nghĩa bằng AI"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-field border border-accent/40 bg-accent/10 px-3 py-2 text-sm font-medium text-accent-text transition-colors hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <MagicWand size={18} className="text-accent" />
                <span className="hidden sm:inline">
                  {aiLookupPending ? "AI đang tra..." : "Tra từ AI"}
                </span>
              </button>
            </div>
            <LookupNote state={lookupState} onApplySuggestion={(s) => handleAiLookup(s)} />

            {/* Live Typing Autocomplete / Spellcheck Banner */}
            {liveLookup && !liveLookup.found && liveLookup.suggestion ? (
              <div className="mt-1 flex items-center justify-between gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-700 dark:text-amber-400 shadow-xs">
                <div className="flex items-center gap-1.5 font-medium">
                  <span>Không tìm thấy từ <strong>&quot;{word}&quot;</strong>. Ý bạn có phải là <strong>&quot;{liveLookup.suggestion}&quot;</strong>?</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    handleAiLookup(liveLookup.suggestion!);
                    setLiveLookup(null);
                  }}
                  className="rounded bg-amber-600 px-2.5 py-1 font-semibold text-white hover:bg-amber-700 transition-colors shrink-0"
                >
                  Dùng từ &quot;{liveLookup.suggestion}&quot;
                </button>
              </div>
            ) : liveLookup && liveLookup.found && liveLookup.card ? (
              <div className="mt-1 flex items-center justify-between gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-2.5 text-xs text-emerald-700 dark:text-emerald-400 shadow-xs">
                <div className="flex flex-col gap-0.5">
                  <span className="font-semibold">
                    Gợi ý AI: {liveLookup.card.meaning} {liveLookup.card.phonetic ? `(${liveLookup.card.phonetic})` : ""}
                  </span>
                  {liveLookup.card.already_in_deck ? (
                    <span className="text-2xs text-amber-600 font-bold">
                      Từ này đã tồn tại trong bộ thẻ (#{liveLookup.card.existing_card_id})
                    </span>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    handleAiLookup(word);
                    setLiveLookup(null);
                  }}
                  className="rounded bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors shrink-0"
                >
                  Điền tự động
                </button>
              </div>
            ) : null}
          </div>
        </Field>

        <Field id="card-meaning" label="Meaning" error={fieldErrors.meaning}>
          <TextInput
            id="card-meaning"
            value={meaning}
            onChange={(event) => setMeaning(event.target.value)}
            invalid={Boolean(fieldErrors.meaning)}
            disabled={pending}
            required
          />
        </Field>

        <Field id="card-phonetic" label="Phonetic" hint="Optional.">
          <TextInput
            id="card-phonetic"
            value={phonetic}
            onChange={(event) => setPhonetic(event.target.value)}
            disabled={pending}
          />
        </Field>

        <Field id="card-pos" label="Part of speech" hint="Optional.">
          <TextInput
            id="card-pos"
            value={partOfSpeech}
            onChange={(event) => setPartOfSpeech(event.target.value)}
            disabled={pending}
          />
        </Field>
      </div>

      <Field id="card-definition" label="Definition" hint="Optional.">
        <TextArea
          id="card-definition"
          rows={2}
          value={definitionEn}
          onChange={(event) => setDefinitionEn(event.target.value)}
          disabled={pending}
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="card-example" label="Ngữ cảnh / Câu ví dụ (EN)" hint="Không bắt buộc.">
          <TextArea
            id="card-example"
            rows={2}
            value={exampleSentence}
            onChange={(event) => setExampleSentence(event.target.value)}
            placeholder="Ví dụ: The office will be closed temporarily due to renovation."
            disabled={pending}
          />
        </Field>

        <Field id="card-example-meaning" label="Nghĩa tiếng Việt của ngữ cảnh (VI)" hint="Không bắt buộc.">
          <TextArea
            id="card-example-meaning"
            rows={2}
            value={exampleMeaning}
            onChange={(event) => setExampleMeaning(event.target.value)}
            placeholder="Ví dụ: Văn phòng sẽ đóng cửa tạm thời do việc sửa chữa."
            disabled={pending}
          />
        </Field>
      </div>

      <Field id="card-note" label="Note" hint="Optional.">
        <TextArea
          id="card-note"
          rows={2}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          disabled={pending}
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="card-image" label="Image" hint="Optional.">
          <div className="flex flex-col gap-3">
            <input
              id="card-image"
              type="file"
              accept="image/*"
              onChange={(event) => setImageFile(event.target.files?.[0] ?? null)}
              disabled={pending}
              className="w-full text-sm text-muted file:mr-4 file:rounded-full file:border file:border-line file:bg-surface file:px-4 file:py-2 file:text-sm file:font-medium file:text-ink"
            />
            {imagePreviewUrl ? (
              <div className="relative flex items-center gap-3 rounded-lg border border-accent bg-accent-soft/30 p-2.5">
                <img
                  src={imagePreviewUrl}
                  alt="Xem trước ảnh chọn"
                  className="h-20 w-20 rounded-md object-cover"
                />
                <div className="flex flex-1 flex-col text-xs">
                  <span className="font-semibold text-accent-text">Ảnh mới vừa chọn</span>
                  <span className="text-muted truncate max-w-[180px]">{imageFile?.name}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setImageFile(null)}
                  className="rounded-full p-2 text-muted hover:bg-surface hover:text-danger transition-colors"
                  title="Xóa chọn ảnh"
                >
                  <Trash size={16} />
                </button>
              </div>
            ) : card?.imageUrl ? (
              <div className="flex items-center gap-3 rounded-lg border border-line bg-surface-2 p-2.5">
                <img
                  src={card.imageUrl}
                  alt="Ảnh hiện tại của card"
                  className="h-20 w-20 rounded-md object-cover"
                />
                <div className="flex flex-col text-xs">
                  <span className="font-semibold text-ink">Ảnh hiện tại</span>
                  <span className="text-muted">Chọn file trên nếu muốn thay đổi ảnh</span>
                </div>
              </div>
            ) : null}
          </div>
        </Field>

        <Field id="card-audio" label="Audio" hint="Optional.">
          <div className="flex flex-col gap-3">
            <input
              id="card-audio"
              type="file"
              accept="audio/*"
              onChange={(event) => setAudioFile(event.target.files?.[0] ?? null)}
              disabled={pending}
              className="w-full text-sm text-muted file:mr-4 file:rounded-full file:border file:border-line file:bg-surface file:px-4 file:py-2 file:text-sm file:font-medium file:text-ink cursor-pointer"
            />
            {audioPreviewUrl ? (
              <div className="flex items-center gap-3 rounded-xl border border-accent bg-accent-soft/30 p-2.5">
                <audio controls src={audioPreviewUrl} className="w-full max-w-[220px]" />
                <button
                  type="button"
                  onClick={() => setAudioFile(null)}
                  className="rounded-full p-2 text-muted hover:bg-surface hover:text-danger transition-colors shrink-0"
                  title="Xóa file âm thanh"
                >
                  <Trash size={16} />
                </button>
              </div>
            ) : card?.audioUrl ? (
              <div className="flex items-center gap-3 rounded-xl border border-line bg-surface-2 p-2.5">
                <audio controls src={card.audioUrl} className="w-full max-w-[220px]" />
                <span className="text-xs text-muted">File âm thanh hiện tại</span>
              </div>
            ) : null}
          </div>
        </Field>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving" : submitLabel}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={pending}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

/**
 * One line of feedback under the word field.
 *
 * "Not found" is worded as a fact about the dictionary rather than a failure,
 * because the reader may well have typed a perfectly good word that Wiktionary
 * does not carry, and because an upstream outage arrives here looking exactly
 * the same. Neither case is the reader's mistake.
 */
function LookupNote({
  state,
  onApplySuggestion,
}: {
  state: LookupState;
  onApplySuggestion?: (suggestion: string) => void;
}) {
  if (state.kind === "idle") return null;

  if (state.kind === "loading") {
    return <p className="text-sm text-muted">Checking the dictionary…</p>;
  }

  if (state.kind === "filled") {
    return (
      <div className="flex flex-col gap-1.5">
        {state.alreadyInDeck ? (
          <div className="rounded-md bg-amber-500/15 p-2.5 text-xs text-amber-700 dark:text-amber-400 border border-amber-500/30 font-semibold flex items-center gap-1.5 shadow-xs">
            <span>Từ vựng này đã tồn tại trong bộ thẻ của bạn {state.existingCardId ? `(Thẻ bài #${state.existingCardId})` : ""}!</span>
          </div>
        ) : null}
        <p className="text-sm text-ok">
          Filled {state.fields.join(", ")} from “{state.entry}”. Edit anything that does not fit.
        </p>
      </div>
    );
  }

  if (state.kind === "nothing-to-fill") {
    return (
      <div className="flex flex-col gap-1.5">
        {state.alreadyInDeck ? (
          <div className="rounded-md bg-amber-500/15 p-2.5 text-xs text-amber-700 dark:text-amber-400 border border-amber-500/30 font-semibold flex items-center gap-1.5 shadow-xs">
            <span>⚠️ Từ vựng này đã tồn tại trong bộ thẻ của bạn {state.existingCardId ? `(Thẻ bài #${state.existingCardId})` : ""}!</span>
          </div>
        ) : null}
        <p className="text-sm text-muted">
          Found “{state.entry}”, but every field it could fill already has something in it.
        </p>
      </div>
    );
  }

  if (state.kind === "suggestion") {
    return (
      <div className="rounded-md bg-amber-500/10 p-2.5 text-sm text-amber-700 dark:text-amber-400 border border-amber-500/20 flex flex-wrap items-center justify-between gap-2">
        <span>
          Không tìm thấy từ <strong>&quot;{state.word}&quot;</strong>. Ý bạn có phải là <strong>&quot;{state.suggestion}&quot;</strong>?
        </span>
        {onApplySuggestion ? (
          <button
            type="button"
            onClick={() => onApplySuggestion(state.suggestion)}
            className="rounded bg-amber-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-amber-700 transition-colors shadow-xs"
          >
            Dùng từ &quot;{state.suggestion}&quot;
          </button>
        ) : null}
      </div>
    );
  }

  if (state.kind === "empty") {
    return (
      <p className="text-sm text-muted">
        No dictionary entry for that word. Fill the fields in yourself.
      </p>
    );
  }

  return <p className="text-sm text-danger">{state.message}</p>;
}
