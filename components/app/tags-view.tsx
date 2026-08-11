"use client";

import { useCallback, useState } from "react";
import { Check } from "@phosphor-icons/react/Check";
import { PencilSimple } from "@phosphor-icons/react/PencilSimple";
import { Trash } from "@phosphor-icons/react/Trash";
import { X } from "@phosphor-icons/react/X";

import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Field, TextInput } from "@/components/ui/field";
import { EmptyState, ErrorState, RowSkeleton } from "@/components/app/states";
import { ApiError } from "@/lib/api/client";
import { createTag, deleteTag, listTags, renameTag } from "@/lib/api/tags";
import type { TagResponse } from "@/lib/api/types";
import { useAsync } from "@/lib/use-async";

export function TagsView() {
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tags = useAsync(
    useCallback((signal: AbortSignal) => listTags(signal), []),
    "tags",
  );

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function onCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newName.trim();
    if (!name) {
      setError("Give the tag a name.");
      return;
    }
    await run(async () => {
      await createTag(name);
      setNewName("");
      tags.reload();
    });
  }

  async function onRename(tag: TagResponse) {
    const name = editingName.trim();
    if (!name) return;
    await run(async () => {
      await renameTag(tag.id, name);
      setEditingId(null);
      tags.reload();
    });
  }

  async function onDelete(tag: TagResponse) {
    if (!window.confirm(`Delete the tag "${tag.name}"?`)) return;
    await run(async () => {
      await deleteTag(tag.id);
      tags.reload();
    });
  }

  return (
    <Container>
      <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Tags</h1>
      <p className="mt-2 max-w-[58ch] text-base text-muted">
        Tags group decks by topic, so you can find the work vocabulary without
        scrolling past everything else.
      </p>

      <form onSubmit={onCreate} noValidate className="mt-8 flex items-end gap-3">
        <Field id="tag-name" label="New tag" className="flex-1">
          <TextInput
            id="tag-name"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            disabled={busy}
            placeholder="Business"
          />
        </Field>
        <Button type="submit" size="lg" disabled={busy}>
          Add tag
        </Button>
      </form>

      {error ? (
        <div className="mt-6">
          <ErrorState message={error} />
        </div>
      ) : null}

      <div className="mt-8">
        {tags.status === "loading" ? <RowSkeleton count={3} /> : null}

        {tags.status === "error" ? (
          <ErrorState message={tags.error} onRetry={tags.reload} />
        ) : null}

        {tags.status === "success" && tags.data.length === 0 ? (
          <EmptyState
            title="No tags yet"
            body="Add your first tag above, then pick it while creating a deck."
          />
        ) : null}

        {tags.status === "success" && tags.data.length > 0 ? (
          <ul className="flex flex-col">
            {tags.data.map((tag) => (
              <li
                key={tag.id}
                className="flex items-center gap-3 border-t border-line py-4 last:border-b"
              >
                {editingId === tag.id ? (
                  <>
                    <TextInput
                      value={editingName}
                      onChange={(event) => setEditingName(event.target.value)}
                      disabled={busy}
                      aria-label={`Rename ${tag.name}`}
                      className="max-w-xs"
                    />
                    <button
                      type="button"
                      onClick={() => onRename(tag)}
                      disabled={busy}
                      aria-label="Save name"
                      className="rounded-full p-2 text-muted transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-40"
                    >
                      <Check aria-hidden size={16} weight="bold" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      disabled={busy}
                      aria-label="Cancel rename"
                      className="rounded-full p-2 text-muted transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-40"
                    >
                      <X aria-hidden size={16} />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-base">{tag.name}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(tag.id);
                        setEditingName(tag.name);
                      }}
                      disabled={busy}
                      aria-label={`Rename ${tag.name}`}
                      className="rounded-full p-2 text-muted transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-40"
                    >
                      <PencilSimple aria-hidden size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(tag)}
                      disabled={busy}
                      aria-label={`Delete ${tag.name}`}
                      className="rounded-full p-2 text-muted transition-colors hover:bg-surface-2 hover:text-danger disabled:opacity-40"
                    >
                      <Trash aria-hidden size={15} />
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </Container>
  );
}
