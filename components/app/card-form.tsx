"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, TextArea, TextInput } from "@/components/ui/field";
import { FormMessage } from "@/components/auth/form-message";
import { ApiError } from "@/lib/api/client";
import type { CardResponse, CardWriteRequest } from "@/lib/api/types";
import { Trash } from "@phosphor-icons/react/Trash";

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
                <audio controls src={audioPreviewUrl} className="h-8 w-full max-w-[220px]" />
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
                <audio controls src={card.audioUrl} className="h-8 w-full max-w-[220px]" />
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
