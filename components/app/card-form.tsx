"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, TextArea, TextInput } from "@/components/ui/field";
import { FormMessage } from "@/components/auth/form-message";
import { ApiError } from "@/lib/api/client";
import type { CardResponse, CardWriteRequest } from "@/lib/api/types";

type CardFiles = { imageFile?: File | null; audioFile?: File | null };

type CardFormProps = {
  card?: CardResponse;
  onSubmit: (request: CardWriteRequest, files: CardFiles) => Promise<unknown>;
  onCancel: () => void;
  submitLabel: string;
};

export function CardForm({
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

  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

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
          <TextInput
            id="card-word"
            value={word}
            onChange={(event) => setWord(event.target.value)}
            invalid={Boolean(fieldErrors.word)}
            disabled={pending}
            required
          />
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
        <Field id="card-example" label="Example sentence" hint="Optional.">
          <TextArea
            id="card-example"
            rows={2}
            value={exampleSentence}
            onChange={(event) => setExampleSentence(event.target.value)}
            disabled={pending}
          />
        </Field>

        <Field id="card-example-meaning" label="Example meaning" hint="Optional.">
          <TextArea
            id="card-example-meaning"
            rows={2}
            value={exampleMeaning}
            onChange={(event) => setExampleMeaning(event.target.value)}
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
          <input
            id="card-image"
            type="file"
            accept="image/*"
            onChange={(event) => setImageFile(event.target.files?.[0] ?? null)}
            disabled={pending}
            className="w-full text-sm text-muted file:mr-4 file:rounded-full file:border file:border-line file:bg-surface file:px-4 file:py-2 file:text-sm file:font-medium file:text-ink"
          />
        </Field>

        <Field id="card-audio" label="Audio" hint="Optional.">
          <input
            id="card-audio"
            type="file"
            accept="audio/*"
            onChange={(event) => setAudioFile(event.target.files?.[0] ?? null)}
            disabled={pending}
            className="w-full text-sm text-muted file:mr-4 file:rounded-full file:border file:border-line file:bg-surface file:px-4 file:py-2 file:text-sm file:font-medium file:text-ink"
          />
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
