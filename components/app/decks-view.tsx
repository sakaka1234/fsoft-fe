"use client";

import { useCallback, useState } from "react";
import { PencilSimple } from "@phosphor-icons/react/PencilSimple";
import { Plus } from "@phosphor-icons/react/Plus";
import { Trash } from "@phosphor-icons/react/Trash";
import { UsersThree } from "@phosphor-icons/react/UsersThree";
import { User } from "@phosphor-icons/react/User";

import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Modal } from "@/components/ui/modal";
import { DeckCard } from "@/components/app/deck-card";
import { DeckForm } from "@/components/app/deck-form";
import { CardSkeleton, EmptyState, ErrorState } from "@/components/app/states";
import { createDeck, deleteDeck, listMyDecks, listSharedWithMeDecks, updateDeck } from "@/lib/api/decks";
import { listTags } from "@/lib/api/tags";
import type { DeckResponse } from "@/lib/api/types";
import { useAsync } from "@/lib/use-async";

export function DecksView() {
  const [tab, setTab] = useState<"my" | "shared">("my");
  const [creating, setCreating] = useState(false);
  const [editingDeckId, setEditingDeckId] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const myDecks = useAsync(
    useCallback((signal: AbortSignal) => listMyDecks(1, 24, signal), []),
    "my-decks",
  );

  const sharedDecks = useAsync(
    useCallback((signal: AbortSignal) => listSharedWithMeDecks(1, 24, signal), []),
    "shared-with-me-decks",
  );

  const tags = useAsync(
    useCallback((signal: AbortSignal) => listTags(signal), []),
    "tags",
  );

  const currentDecksState = tab === "my" ? myDecks : sharedDecks;

  const editingDeck = myDecks.status === "success"
    ? myDecks.data.content.find((d) => d.id === editingDeckId)
    : null;

  async function onDelete(deck: DeckResponse) {
    if (!window.confirm(`Delete "${deck.title}" and every card in it?`)) return;
    setBusyId(deck.id);
    try {
      await deleteDeck(deck.id);
      myDecks.reload();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Container size="wide">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
            {tab === "my" ? "Your decks" : "Shared with me"}
          </h1>
          <p className="mt-2 text-base text-muted">
            {tab === "my"
              ? "Each deck holds the words you are working on right now."
              : "Decks that other members have granted you access to."}
          </p>
        </div>
        {tab === "my" && !creating ? (
          <Button onClick={() => setCreating(true)}>
            <Plus aria-hidden size={16} weight="bold" />
            New deck
          </Button>
        ) : null}
      </div>

      {/* Tab Switcher */}
      <div className="mt-6 flex border-b border-line">
        <button
          type="button"
          onClick={() => setTab("my")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
            tab === "my"
              ? "border-accent-text text-accent-text"
              : "border-transparent text-muted hover:text-ink"
          }`}
        >
          <User aria-hidden size={18} />
          Bộ thẻ của tôi ({myDecks.status === "success" ? myDecks.data.totalElements : 0})
        </button>

        <button
          type="button"
          onClick={() => setTab("shared")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
            tab === "shared"
              ? "border-accent-text text-accent-text"
              : "border-transparent text-muted hover:text-ink"
          }`}
        >
          <UsersThree aria-hidden size={18} />
          Được chia sẻ với tôi ({sharedDecks.status === "success" ? sharedDecks.data.totalElements : 0})
        </button>
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
              myDecks.reload();
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
              myDecks.reload();
            }}
          />
        ) : null}
      </Modal>

      <div className="mt-8">
        {currentDecksState.status === "loading" ? <CardSkeleton count={6} /> : null}

        {currentDecksState.status === "error" ? (
          <ErrorState message={currentDecksState.error} onRetry={currentDecksState.reload} />
        ) : null}

        {currentDecksState.status === "success" && currentDecksState.data.content.length === 0 ? (
          <EmptyState
            title={tab === "my" ? "No decks yet" : "Chưa có bộ thẻ nào được chia sẻ"}
            body={
              tab === "my"
                ? "A deck is a set of cards you study together, for example the words you keep meeting at work. Create one and add your first card."
                : "Khi ai đó chia sẻ bộ thẻ với bạn qua email, các bộ thẻ đó sẽ hiển thị ở đây."
            }
            action={
              tab === "my" && !creating ? (
                <Button onClick={() => setCreating(true)}>Create a deck</Button>
              ) : null
            }
          />
        ) : null}

        {currentDecksState.status === "success" && currentDecksState.data.content.length > 0 ? (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {currentDecksState.data.content.map((deck) => (
              <li key={deck.id}>
                <DeckCard
                  deck={deck}
                  actions={
                    tab === "my" ? (
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
                    ) : undefined
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
