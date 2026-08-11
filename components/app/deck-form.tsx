"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, SelectInput, TextArea, TextInput } from "@/components/ui/field";
import { FormMessage } from "@/components/auth/form-message";
import { ApiError } from "@/lib/api/client";
import type {
  DeckResponse,
  DeckVisibility,
  DeckWriteRequest,
  TagResponse,
} from "@/lib/api/types";
import { cn } from "@/lib/cn";

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "vi", label: "Vietnamese" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
  { code: "zh", label: "Chinese" },
  { code: "fr", label: "French" },
] as const;

const VISIBILITIES: { value: DeckVisibility; label: string; hint: string }[] = [
  { value: "PRIVATE", label: "Private", hint: "Only you can open it." },
  { value: "SHARED", label: "Shared", hint: "Anyone with the link." },
  { value: "PUBLIC", label: "Public", hint: "Listed for everyone." },
];

type DeckFormProps = {
  /** Present when editing, absent when creating. */
  deck?: DeckResponse;
  tags: TagResponse[];
  onSubmit: (
    request: DeckWriteRequest,
    coverImage: File | null,
  ) => Promise<unknown>;
  onCancel: () => void;
  submitLabel: string;
};

export function DeckForm({
  deck,
  tags,
  onSubmit,
  onCancel,
  submitLabel,
}: DeckFormProps) {
  const [title, setTitle] = useState(deck?.title ?? "");
  const [description, setDescription] = useState(deck?.description ?? "");
  const [sourceLanguage, setSourceLanguage] = useState(
    deck?.sourceLanguage ?? "en",
  );
  const [targetLanguage, setTargetLanguage] = useState(
    deck?.targetLanguage ?? "vi",
  );
  const [visibility, setVisibility] = useState<DeckVisibility>(
    deck?.visibility ?? "PRIVATE",
  );
  const [tagIds, setTagIds] = useState<number[]>(
    deck?.tags.map((tag) => tag.id) ?? [],
  );
  const [coverImage, setCoverImage] = useState<File | null>(null);

  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function toggleTag(id: number) {
    setTagIds((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    if (!title.trim()) {
      setFieldErrors({ title: "Give the deck a title." });
      return;
    }

    setPending(true);
    try {
      await onSubmit(
        {
          title: title.trim(),
          description: description.trim() || undefined,
          sourceLanguage,
          targetLanguage,
          visibility,
          tagIds,
          // Not exposed in the UI: it marks a deck as curated by the platform,
          // and it has to be sent because the server field is a primitive.
          isOfficial: deck?.official ?? false,
        },
        coverImage,
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
      className="flex flex-col gap-5 rounded-card border border-line bg-surface p-6 md:p-7"
    >
      {formError ? <FormMessage>{formError}</FormMessage> : null}

      <Field id="deck-title" label="Title" error={fieldErrors.title}>
        <TextInput
          id="deck-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          invalid={Boolean(fieldErrors.title)}
          disabled={pending}
          required
        />
      </Field>

      <Field
        id="deck-description"
        label="Description"
        hint="Optional."
        error={fieldErrors.description}
      >
        <TextArea
          id="deck-description"
          rows={3}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          disabled={pending}
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="deck-source" label="Learning from">
          <SelectInput
            id="deck-source"
            value={sourceLanguage}
            onChange={(event) => setSourceLanguage(event.target.value)}
            disabled={pending}
          >
            {LANGUAGES.map((language) => (
              <option key={language.code} value={language.code}>
                {language.label}
              </option>
            ))}
          </SelectInput>
        </Field>

        <Field id="deck-target" label="Translated into">
          <SelectInput
            id="deck-target"
            value={targetLanguage}
            onChange={(event) => setTargetLanguage(event.target.value)}
            disabled={pending}
          >
            {LANGUAGES.map((language) => (
              <option key={language.code} value={language.code}>
                {language.label}
              </option>
            ))}
          </SelectInput>
        </Field>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium text-ink">Visibility</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {VISIBILITIES.map((option) => (
            <label
              key={option.value}
              className={cn(
                "flex cursor-pointer flex-col gap-1 rounded-field border p-3.5 transition-colors",
                visibility === option.value
                  ? "border-accent bg-accent-soft"
                  : "border-line hover:border-ink/25",
              )}
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="radio"
                  name="visibility"
                  value={option.value}
                  checked={visibility === option.value}
                  onChange={() => setVisibility(option.value)}
                  disabled={pending}
                  className="accent-accent"
                />
                {option.label}
              </span>
              <span className="text-sm text-muted">{option.hint}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium text-ink">Tags</legend>
        {tags.length === 0 ? (
          <p className="text-sm text-muted">
            No tags yet. Create them on the Tags page and they will show up here.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => {
              const selected = tagIds.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTag(tag.id)}
                  aria-pressed={selected}
                  disabled={pending}
                  className={cn(
                    "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                    selected
                      ? "border-accent bg-accent text-accent-fg"
                      : "border-line text-muted hover:text-ink",
                  )}
                >
                  {tag.name}
                </button>
              );
            })}
          </div>
        )}
      </fieldset>

      <Field
        id="deck-cover"
        label="Cover image"
        hint="Optional. Leave empty to keep the current one."
      >
        <input
          id="deck-cover"
          type="file"
          accept="image/*"
          onChange={(event) => setCoverImage(event.target.files?.[0] ?? null)}
          disabled={pending}
          className="w-full text-sm text-muted file:mr-4 file:rounded-full file:border file:border-line file:bg-surface file:px-4 file:py-2 file:text-sm file:font-medium file:text-ink"
        />
      </Field>

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
