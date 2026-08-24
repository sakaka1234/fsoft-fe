"use client";

import { useCallback, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PencilSimple } from "@phosphor-icons/react/PencilSimple";
import { Plus } from "@phosphor-icons/react/Plus";
import { Trash } from "@phosphor-icons/react/Trash";
import { UsersThree } from "@phosphor-icons/react/UsersThree";
import { User } from "@phosphor-icons/react/User";
import { Brain } from "@phosphor-icons/react/Brain";

import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Modal } from "@/components/ui/modal";
import { DeckCard } from "@/components/app/deck-card";
import { DeckForm } from "@/components/app/deck-form";
import { FsrsVocabularyReviewView } from "@/components/app/fsrs-vocabulary-review-view";
import { CardSkeleton, EmptyState, ErrorState } from "@/components/app/states";
import { createDeck, deleteDeck, listMyDecks, listSharedWithMeDecks, updateDeck } from "@/lib/api/decks";
import { listTags } from "@/lib/api/tags";
import type { DeckResponse } from "@/lib/api/types";
import { useAsync } from "@/lib/use-async";

type DeckTab = "my" | "shared" | "srs";

export function DecksView({ defaultTab }: { defaultTab?: DeckTab }) {
  /* The URL is the tab, rather than state mirrored from it in an effect.
     That mirror tripped react-hooks/set-state-in-effect, and it was also the
     only thing making the reminder toast work: it pushes /decks?tab=srs, and
     when the reader is already on /decks that is a search-param change with no
     remount, so seeding state once would have ignored it. Deriving also gets
     the back button and deep links right for free. */
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlTab = searchParams?.get("tab");

  const tab: DeckTab =
    urlTab === "my" || urlTab === "shared" || urlTab === "srs"
      ? urlTab
      : (defaultTab ?? "my");

  const setTab = useCallback(
    (next: DeckTab) => {
      router.replace(pathname + "?tab=" + next, { scroll: false });
    },
    [router, pathname],
  );

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
      {/* Tab Switcher & Action Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line">
        <div className="flex overflow-x-auto">
          <button
            type="button"
            onClick={() => setTab("my")}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
              tab === "my"
                ? "border-accent-text text-accent-text font-bold"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            <User aria-hidden size={18} />
            Bộ thẻ của tôi ({myDecks.status === "success" ? myDecks.data.totalElements : 0})
          </button>

          <button
            type="button"
            onClick={() => setTab("shared")}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
              tab === "shared"
                ? "border-accent-text text-accent-text font-bold"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            <UsersThree aria-hidden size={18} />
            Được chia sẻ với tôi ({sharedDecks.status === "success" ? sharedDecks.data.totalElements : 0})
          </button>

          <button
            type="button"
            onClick={() => setTab("srs")}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
              tab === "srs"
                ? "border-accent-text text-accent-text font-bold"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            <Brain aria-hidden size={18} weight="fill" className="text-accent-text" />
            Ôn tập từ vựng (FSRS)
          </button>
        </div>

        {tab === "my" && !creating ? (
          <Button onClick={() => setCreating(true)} className="mb-1">
            <Plus aria-hidden size={16} weight="bold" />
            New deck
          </Button>
        ) : null}
      </div>

      {tab === "srs" ? (
        <FsrsVocabularyReviewView />
      ) : null}

      {creating ? (
        <div className="mt-8">
          <DeckForm
            tags={tags.data ?? []}
            submitLabel="Create deck"
            onCancel={() => setCreating(false)}
            onSubmit={async (payload, coverImage) => {
              await createDeck(payload, coverImage);
              setCreating(false);
              myDecks.reload();
            }}
          />
        </div>
      ) : null}

      {tab !== "srs" && currentDecksState.status === "loading" ? (
        <div className="mt-8">
          <CardSkeleton count={6} />
        </div>
      ) : null}

      {tab !== "srs" && currentDecksState.status === "error" ? (
        <div className="mt-8">
          <ErrorState
            message={currentDecksState.error}
            onRetry={currentDecksState.reload}
          />
        </div>
      ) : null}

      {tab !== "srs" && currentDecksState.status === "success" && currentDecksState.data.content.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title={tab === "my" ? "No decks yet" : "Nothing shared yet"}
            body={
              tab === "my"
                ? "Create a deck to start adding words, or explore public decks."
                : "When someone shares a deck with your email, it will appear here."
            }
          />
        </div>
      ) : null}

      {tab !== "srs" && currentDecksState.status === "success" && currentDecksState.data.content.length > 0 ? (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {currentDecksState.data.content.map((deck) => (
            <DeckCard
              key={deck.id}
              deck={deck}
              actions={
                <>
                  <button
                    type="button"
                    onClick={() => setEditingDeckId(deck.id)}
                    aria-label={"Sửa " + deck.title}
                    disabled={busyId === deck.id}
                    className="inline-flex size-10 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-50"
                  >
                    <PencilSimple aria-hidden size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(deck)}
                    aria-label={"Xoá " + deck.title}
                    disabled={busyId === deck.id}
                    className="inline-flex size-10 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-danger disabled:opacity-50"
                  >
                    <Trash aria-hidden size={16} />
                  </button>
                </>
              }
            />
          ))}
        </div>
      ) : null}

      {editingDeck ? (
        <Modal
          isOpen
          onClose={() => setEditingDeckId(null)}
          title={`Edit "${editingDeck.title}"`}
        >
          <DeckForm
            deck={editingDeck}
            tags={tags.data ?? []}
            submitLabel="Save deck"
            onCancel={() => setEditingDeckId(null)}
            onSubmit={async (payload, coverImage) => {
              await updateDeck(editingDeck.id, payload, coverImage);
              setEditingDeckId(null);
              myDecks.reload();
            }}
          />
        </Modal>
      ) : null}
    </Container>
  );
}
