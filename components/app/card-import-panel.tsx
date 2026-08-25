"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, TextArea, TextInput } from "@/components/ui/field";
import { FormMessage } from "@/components/auth/form-message";
import { RowSkeleton } from "@/components/app/states";
import { ApiError } from "@/lib/api/client";
import {
  EXTRACTION_ACCEPT,
  EXTRACTION_MAX_FILE_BYTES,
  extractCardsFromFile,
  extractCardsFromText,
  extractCardsFromUrl,
} from "@/lib/api/ai";
import { createCard } from "@/lib/api/cards";
import type { CardCreationRequest } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { TextT } from "@phosphor-icons/react/TextT";
import { Link as LinkIcon } from "@phosphor-icons/react/Link";
import { FileArrowUp } from "@phosphor-icons/react/FileArrowUp";

/*
  Draft cards out of source material.

  Three things about the backend shape this component, all established by
  probing it rather than reading the spec:

  - `category` is required even though the spec says otherwise, and omitting it
    is a raw server NPE rather than a validation error. It is a required field
    in this form for that reason.
  - Extraction takes anywhere from 1.5 to 50 seconds, median about 15. That is
    a skeleton, not a spinner, and the copy says so rather than leaving someone
    wondering whether it hung.
  - Every probe so far answered success with an empty list. So "it worked and
    found nothing" is a first class outcome here, worded as a fact about the
    material rather than as an error, because it is not the reader's fault and
    is currently the norm.
*/

type Source = "text" | "url" | "file";

const SOURCES: { key: Source; label: string; Icon: typeof TextT }[] = [
  { key: "text", label: "Paste text", Icon: TextT },
  { key: "url", label: "From a link", Icon: LinkIcon },
  { key: "file", label: "Upload a file", Icon: FileArrowUp },
];

type Phase =
  | { kind: "idle" }
  | { kind: "extracting" }
  | { kind: "drafts"; cards: CardCreationRequest[] }
  | { kind: "none" }
  | { kind: "error"; message: string }
  | { kind: "saving"; done: number; total: number };

type CardImportPanelProps = {
  deckId: number;
  /** Where to number the first imported card. */
  nextPosition: number;
  onImported: () => void;
  onClose: () => void;
};

export function CardImportPanel({
  deckId,
  nextPosition,
  onImported,
  onClose,
}: CardImportPanelProps) {
  const [source, setSource] = useState<Source>("text");
  const [category, setCategory] = useState("VOCABULARY");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [chosen, setChosen] = useState<Set<number>>(new Set());

  const busy = phase.kind === "extracting" || phase.kind === "saving";

  function extract() {
    setPhase({ kind: "extracting" });

    const request =
      source === "text"
        ? extractCardsFromText({ text, category, deckId })
        : source === "url"
          ? extractCardsFromUrl({ url, category, deckId })
          : file
            ? extractCardsFromFile(file, { category, deckId })
            : Promise.reject(new ApiError("Choose a file first.", 400));

    request
      .then((cards) => {
        if (cards.length === 0) {
          setPhase({ kind: "none" });
          return;
        }
        setChosen(new Set(cards.map((_, index) => index)));
        setPhase({ kind: "drafts", cards });
      })
      .catch((error) => {
        setPhase({
          kind: "error",
          message:
            error instanceof ApiError
              ? error.message
              : "Extraction failed. Try again.",
        });
      });
  }

  /*
    There is no bulk create endpoint, so the chosen drafts go in one at a time
    and the count is shown while it runs. Positions continue from the end of
    the deck so imported cards land after the existing ones rather than
    fighting them for a slot.
  */
  async function saveChosen() {
    if (phase.kind !== "drafts") return;
    const picked = phase.cards.filter((_, index) => chosen.has(index));
    setPhase({ kind: "saving", done: 0, total: picked.length });

    let saved = 0;
    try {
      for (const draft of picked) {
        await createCard(deckId, {
          word: draft.word,
          meaning: draft.meaning,
          phonetic: draft.phonetic,
          partOfSpeech: draft.partOfSpeech,
          definitionEn: draft.definitionEn,
          exampleSentence: draft.exampleSentence,
          exampleMeaning: draft.exampleMeaning,
          note: draft.note,
          position: nextPosition + saved,
        });
        saved += 1;
        setPhase({ kind: "saving", done: saved, total: picked.length });
      }
      onImported();
      onClose();
    } catch (error) {
      /*
        Partial success is real: some cards may already be in the deck. Say how
        many so the reader knows whether to retry the whole batch or not.
      */
      setPhase({
        kind: "error",
        message:
          `Saved ${saved} of ${picked.length}. ` +
          (error instanceof ApiError ? error.message : "The rest failed."),
      });
    }
  }

  function toggle(index: number) {
    setChosen((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  const canExtract =
    !busy &&
    category.trim().length > 0 &&
    ((source === "text" && text.trim().length > 0) ||
      (source === "url" && url.trim().length > 0) ||
      (source === "file" && file !== null));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-2">
        {SOURCES.map(({ key, label, Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setSource(key);
              setPhase({ kind: "idle" });
            }}
            disabled={busy}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors disabled:opacity-50",
              source === key
                ? "border-accent bg-accent-soft text-accent-text"
                : "border-line text-muted hover:border-accent hover:text-accent-text",
            )}
          >
            <Icon aria-hidden size={16} />
            {label}
          </button>
        ))}
      </div>

      {phase.kind === "drafts" || phase.kind === "saving" ? null : (
        <div className="flex flex-col gap-4">
          {source === "text" ? (
            <Field
              id="import-text"
              label="Text"
              hint="Prose or a word list. Longer material takes longer."
            >
              <TextArea
                id="import-text"
                rows={7}
                value={text}
                onChange={(event) => setText(event.target.value)}
                disabled={busy}
              />
            </Field>
          ) : null}

          {source === "url" ? (
            <Field
              id="import-url"
              label="Link"
              hint="A page the server can reach. A dead link and a bad address fail the same way."
            >
              <TextInput
                id="import-url"
                value={url}
                placeholder="https://"
                onChange={(event) => setUrl(event.target.value)}
                disabled={busy}
              />
            </Field>
          ) : null}

          {source === "file" ? (
            <Field
              id="import-file"
              label="File"
              hint={`Text, PDF, Word, or an image. Up to ${Math.round(
                EXTRACTION_MAX_FILE_BYTES / 1024,
              )} KB.`}
            >
              <input
                id="import-file"
                type="file"
                accept={EXTRACTION_ACCEPT}
                disabled={busy}
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                className="w-full rounded-field border border-line bg-surface px-3 py-2 text-sm file:mr-3 file:rounded-full file:border-0 file:bg-accent-soft file:px-3 file:py-1.5 file:text-accent-text"
              />
            </Field>
          ) : null}

          <Field
            id="import-category"
            label="Category"
            hint="Required by the server. It groups what comes back."
          >
            <TextInput
              id="import-category"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              disabled={busy}
            />
          </Field>
        </div>
      )}

      {phase.kind === "extracting" ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted">
            Reading your material. This usually takes about fifteen seconds and
            can take up to a minute.
          </p>
          <RowSkeleton count={3} />
        </div>
      ) : null}

      {phase.kind === "none" ? (
        <div className="rounded-card border border-line bg-surface-2 p-5">
          <p className="text-sm text-ink">No cards came back from that.</p>
          <p className="mt-1 text-sm text-muted">
            The request succeeded, the extractor just did not find anything it
            could turn into a card. Try richer material, or add the cards by
            hand.
          </p>
        </div>
      ) : null}

      {phase.kind === "error" ? <FormMessage>{phase.message}</FormMessage> : null}

      {phase.kind === "saving" ? (
        <p className="text-sm text-muted">
          Saving {phase.done} of {phase.total}…
        </p>
      ) : null}

      {phase.kind === "drafts" ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted">
            {chosen.size} of {phase.cards.length} selected. Untick anything you
            do not want.
          </p>
          <ul className="flex max-h-80 flex-col gap-2 overflow-y-auto">
            {phase.cards.map((draft, index) => (
              <li key={`${draft.word}-${index}`}>
                <label className="flex cursor-pointer items-start gap-3 rounded-field border border-line p-3 transition-colors hover:border-accent">
                  <input
                    type="checkbox"
                    checked={chosen.has(index)}
                    onChange={() => toggle(index)}
                    className="mt-1 size-4 accent-accent"
                  />
                  <span className="flex flex-col gap-0.5">
                    <span className="font-semibold text-ink">
                      {draft.word}
                      {draft.phonetic ? (
                        <span className="ml-2 font-normal text-muted">
                          {draft.phonetic}
                        </span>
                      ) : null}
                    </span>
                    <span className="text-sm text-muted">{draft.meaning}</span>
                    {draft.exampleSentence ? (
                      <span className="text-sm italic text-muted">
                        {draft.exampleSentence}
                      </span>
                    ) : null}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        {phase.kind === "drafts" ? (
          <>
            <Button
              variant="secondary"
              onClick={() => setPhase({ kind: "idle" })}
            >
              Start over
            </Button>
            <Button onClick={saveChosen} disabled={chosen.size === 0}>
              Add {chosen.size} {chosen.size === 1 ? "card" : "cards"}
            </Button>
          </>
        ) : (
          <Button onClick={extract} disabled={!canExtract}>
            {phase.kind === "extracting" ? "Reading…" : "Find cards"}
          </Button>
        )}
      </div>
    </div>
  );
}
