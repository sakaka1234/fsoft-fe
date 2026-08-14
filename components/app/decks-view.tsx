"use client";

import { useCallback, useState } from "react";
import { Plus } from "@phosphor-icons/react/Plus";
import { Trash } from "@phosphor-icons/react/Trash";

import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { DeckCard } from "@/components/app/deck-card";
import { DeckForm } from "@/components/app/deck-form";
import { CardSkeleton, EmptyState, ErrorState } from "@/components/app/states";
import { createDeck, deleteDeck, listMyDecks } from "@/lib/api/decks";
import { listTags } from "@/lib/api/tags";
import type { DeckResponse } from "@/lib/api/types";
import { useAsync } from "@/lib/use-async";

export function DecksView() {
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const decks = useAsync(
    useCallback((signal: AbortSignal) => listMyDecks(1, 24, signal), []),
    "my-decks",
  );
  const tags = useAsync(
    useCallback((signal: AbortSignal) => listTags(signal), []),
    "tags",
  );

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
                    <button
                      type="button"
                      onClick={() => onDelete(deck)}
                      disabled={busyId === deck.id}
                      aria-label={`Delete ${deck.title}`}
                      className="shrink-0 rounded-full p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-danger disabled:opacity-50"
                    >
                      <Trash aria-hidden size={16} />
                    </button>
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
