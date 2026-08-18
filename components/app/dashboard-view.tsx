"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GitFork } from "@phosphor-icons/react/GitFork";
import { Globe } from "@phosphor-icons/react/Globe";
import { Lock } from "@phosphor-icons/react/Lock";
import { PencilSimple } from "@phosphor-icons/react/PencilSimple";
import { Tag } from "@phosphor-icons/react/Tag";
import { Trash } from "@phosphor-icons/react/Trash";
import { UsersThree } from "@phosphor-icons/react/UsersThree";

import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { Container } from "@/components/ui/container";
import { Modal } from "@/components/ui/modal";
import { DeckCard } from "@/components/app/deck-card";
import { DeckForm } from "@/components/app/deck-form";
import { CardSkeleton, EmptyState, ErrorState } from "@/components/app/states";
import { StreakPanel } from "@/components/app/streak-panel";
import { ApiError } from "@/lib/api/client";
import { deleteDeck, forkDeck, listMyDecks, listPublicDecks, updateDeck } from "@/lib/api/decks";
import { listTags } from "@/lib/api/tags";
import type { DeckResponse } from "@/lib/api/types";
import { useSession } from "@/lib/auth/use-session";
import { useAsync } from "@/lib/use-async";

/**
 * Counting my decks by visibility has to happen here rather than through
 * /decks/status: that endpoint answers across all users, so it would report
 * the whole catalogue as if it were mine. Verified live.
 */
const STAT_TILES = [
  { key: "PRIVATE", label: "Private decks", Icon: Lock },
  { key: "PUBLIC", label: "Public decks", Icon: Globe },
  { key: "SHARED", label: "Shared decks", Icon: UsersThree },
] as const;

function countByVisibility(decks: DeckResponse[], visibility: string) {
  return decks.filter((deck) => deck.visibility === visibility).length;
}

export function DashboardView() {
  const session = useSession();
  const router = useRouter();
  const [forkingId, setForkingId] = useState<number | null>(null);
  const [editingDeckId, setEditingDeckId] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [forkError, setForkError] = useState<string | null>(null);

  // A page big enough to hold the whole library, so the tiles count everything
  // rather than the first page. Revisit if a user ever passes 200 decks.
  const myDecks = useAsync(
    useCallback((signal: AbortSignal) => listMyDecks(1, 200, signal), []),
    "dashboard-my-decks",
  );
  const tags = useAsync(
    useCallback((signal: AbortSignal) => listTags(signal), []),
    "tags",
  );
  const publicDecks = useAsync(
    useCallback(
      (signal: AbortSignal) => listPublicDecks({ page: 1, size: 6 }, signal),
      [],
    ),
    "dashboard-public-decks",
  );

  const firstName = session?.user.fullName?.trim().split(" ").at(-1);
  const all = myDecks.status === "success" ? myDecks.data.content : [];
  const recent = all.slice(0, 6);

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

  async function onFork(deck: DeckResponse) {
    setForkingId(deck.id);
    setForkError(null);
    try {
      const copy = await forkDeck(deck.id);
      router.push(`/decks/${copy.id}`);
    } catch (error) {
      setForkError(
        error instanceof ApiError
          ? error.message
          : "Could not copy that deck. Please try again.",
      );
      setForkingId(null);
    }
  }

  return (
    <Container size="wide">
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

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
            {firstName ? `Welcome back, ${firstName}` : "Welcome back"}
          </h1>
          <p className="mt-2 text-base text-muted">
            Your decks, and what other learners are sharing.
          </p>
        </div>
        <ButtonLink href="/decks">Go to your decks</ButtonLink>
      </div>

      <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STAT_TILES.map(({ key, label, Icon }) => (
          <li
            key={key}
            className="flex flex-col gap-3 rounded-card border border-line bg-surface p-6"
          >
            <Icon aria-hidden size={20} weight="duotone" className="text-accent-text" />
            <p className="font-mono text-3xl tracking-tight tabular-nums">
              {myDecks.status === "success" ? countByVisibility(all, key) : "-"}
            </p>
            <p className="text-sm text-muted">{label}</p>
          </li>
        ))}
        <li className="flex flex-col gap-3 rounded-card border border-line bg-surface p-6">
          <Tag aria-hidden size={20} weight="duotone" className="text-accent-text" />
          <p className="font-mono text-3xl tracking-tight tabular-nums">
            {tags.status === "success" ? tags.data.length : "-"}
          </p>
          <p className="text-sm text-muted">Tags</p>
        </li>
      </ul>

      <StreakPanel />

      <section className="mt-14" aria-labelledby="recent-title">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 id="recent-title" className="text-xl font-semibold tracking-tight">
            Your decks
          </h2>
          <Link
            href="/decks"
            className="text-sm font-medium text-accent-text underline underline-offset-4"
          >
            See all
          </Link>
        </div>

        <div className="mt-6">
          {myDecks.status === "loading" ? <CardSkeleton count={3} /> : null}
          {myDecks.status === "error" ? (
            <ErrorState message={myDecks.error} onRetry={myDecks.reload} />
          ) : null}
          {myDecks.status === "success" && recent.length === 0 ? (
            <EmptyState
              title="No decks yet"
              body="A deck holds the words you study together. Create your first one, or copy a public deck below to start from something."
              action={<ButtonLink href="/decks">Create a deck</ButtonLink>}
            />
          ) : null}
          {recent.length > 0 ? (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {recent.map((deck) => (
                <li key={deck.id}>
                  <DeckCard
                    deck={deck}
                    actions={
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setEditingDeckId(deck.id);
                          }}
                          disabled={busyId === deck.id}
                          aria-label={`Edit ${deck.title}`}
                          className="shrink-0 rounded-full p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-50"
                          title="Chỉnh sửa bộ thẻ"
                        >
                          <PencilSimple aria-hidden size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onDelete(deck);
                          }}
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
      </section>

      <section className="mt-14" aria-labelledby="discover-title">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2
            id="discover-title"
            className="text-xl font-semibold tracking-tight"
          >
            Public decks
          </h2>
          <Link
            href="/explore"
            className="text-sm font-medium text-accent-text underline underline-offset-4"
          >
            Browse all
          </Link>
        </div>

        {forkError ? (
          <div className="mt-6">
            <ErrorState message={forkError} />
          </div>
        ) : null}

        <div className="mt-6">
          {publicDecks.status === "loading" ? <CardSkeleton count={3} /> : null}
          {publicDecks.status === "error" ? (
            <ErrorState
              message={publicDecks.error}
              onRetry={publicDecks.reload}
            />
          ) : null}
          {publicDecks.status === "success" &&
          publicDecks.data.content.length === 0 ? (
            <EmptyState
              title="Nothing shared yet"
              body="When learners publish a deck it shows up here, ready to copy into your own list."
            />
          ) : null}
          {publicDecks.status === "success" &&
          publicDecks.data.content.length > 0 ? (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {publicDecks.data.content.map((deck) => (
                <li key={deck.id}>
                  <DeckCard
                    deck={deck}
                    footer={
                      <Button
                        variant="secondary"
                        onClick={() => onFork(deck)}
                        disabled={forkingId === deck.id}
                        className="w-full"
                      >
                        <GitFork aria-hidden size={15} />
                        {forkingId === deck.id ? "Copying" : "Copy to my decks"}
                      </Button>
                    }
                  />
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </section>
    </Container>
  );
}
