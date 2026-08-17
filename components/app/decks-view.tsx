"use client";

import { useCallback, useState } from "react";
import { PencilSimple } from "@phosphor-icons/react/PencilSimple";
import { Plus } from "@phosphor-icons/react/Plus";
import { Trash } from "@phosphor-icons/react/Trash";

import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Modal } from "@/components/ui/modal";
import { DeckCard } from "@/components/app/deck-card";
import { DeckForm } from "@/components/app/deck-form";
import { CardSkeleton, EmptyState, ErrorState } from "@/components/app/states";
import { createDeck, deleteDeck, listMyDecks, updateDeck } from "@/lib/api/decks";
import { listTags } from "@/lib/api/tags";
import type { DeckResponse } from "@/lib/api/types";
import { useAsync } from "@/lib/use-async";

export function DecksView() {
  const [creating, setCreating] = useState(false);
  const [editingDeckId, setEditingDeckId] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const decks = useAsync(
    useCallback((signal: AbortSignal) => listMyDecks(1, 24, signal), []),
    "my-decks",
  );
  const tags = useAsync(
    useCallback((signal: AbortSignal) => listTags(signal), []),
    "tags",
  );

  const editingDeck = decks.status === "success"
    ? decks.data.content.find((d) => d.id === editingDeckId)
    : null;

  async function onDelete(deck: DeckResponse) {
    if (!window.confirm(`Delete "${deck.title}" and every card in it?`)) return;
    setBusyId(deck.id);
    try {
      await deleteDeck(deck.id);
      decks.reload();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Container size="wide">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Your decks
          </h1>
          <p className="mt-2 text-base text-muted">
            Each deck holds the words you are working on right now.
          </p>
        </div>
        {!creating ? (
          <Button onClick={() => setCreating(true)}>
            <Plus aria-hidden size={16} weight="bold" />
            New deck
          </Button>
        ) : null}
      </div>

      {creating ? (
        <div className="mt-8">
          <DeckForm
            tags={tags.data ?? []}
            submitLabel="Create deck"
            onCancel={() => setCreating(false)}
            onSubmit={async (request, coverImage) => {
              await createDeck(request, coverImage);
              setCreating(false);
              decks.reload();
            }}
          />
        </div>
      ) : null}

      {/* Edit Deck Modal */}
      <Modal
        isOpen={Boolean(editingDeckId && editingDeck)}
        onClose={() => setEditingDeckId(null)}
        title="Chỉnh sửa bộ thẻ"
      >
        {editingDeck ? (
          <DeckForm
            deck={editingDeck}
            tags={tags.data ?? []}
            submitLabel="Save deck"
            onCancel={() => setEditingDeckId(null)}
            onSubmit={async (request, coverImage) => {
              await updateDeck(editingDeck.id, request, coverImage);
              setEditingDeckId(null);
              decks.reload();
            }}
          />
        ) : null}
      </Modal>

      <div className="mt-10">
        {decks.status === "loading" ? <CardSkeleton count={6} /> : null}

        {decks.status === "error" ? (
          <ErrorState message={decks.error} onRetry={decks.reload} />
        ) : null}

        {decks.status === "success" && decks.data.content.length === 0 ? (
          <EmptyState
            title="No decks yet"
            body="A deck is a set of cards you study together, for example the words you keep meeting at work. Create one and add your first card."
            action={
              !creating ? (
                <Button onClick={() => setCreating(true)}>Create a deck</Button>
              ) : null
            }
          />
        ) : null}

        {decks.status === "success" && decks.data.content.length > 0 ? (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {decks.data.content.map((deck) => (
              <li key={deck.id}>
                <DeckCard
                  deck={deck}
                  actions={
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setEditingDeckId(deck.id)}
                        disabled={busyId === deck.id}
                        aria-label={`Edit ${deck.title}`}
                        className="shrink-0 rounded-full p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-50"
                        title="Chỉnh sửa bộ thẻ"
                      >
                        <PencilSimple aria-hidden size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(deck)}
                        disabled={busyId === deck.id}
                        aria-label={`Delete ${deck.title}`}
                        className="shrink-0 rounded-full p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-danger disabled:opacity-50"
                        title="Xóa bộ thẻ"
                      >
                        <Trash aria-hidden size={16} />
                      </button>
                    </div>
                  }
                />
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </Container>
  );
}
