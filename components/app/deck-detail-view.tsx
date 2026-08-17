"use client";

import { useSession } from "@/lib/auth/use-session";
import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown } from "@phosphor-icons/react/ArrowDown";
import { ArrowLeft } from "@phosphor-icons/react/ArrowLeft";
import { ArrowUp } from "@phosphor-icons/react/ArrowUp";
import { PencilSimple } from "@phosphor-icons/react/PencilSimple";
import { Plus } from "@phosphor-icons/react/Plus";
import { Trash } from "@phosphor-icons/react/Trash";
import { Cards as CardsIcon } from "@phosphor-icons/react/Cards";
import { List } from "@phosphor-icons/react/List";
import { GameController } from "@phosphor-icons/react/GameController";
import { Users } from "@phosphor-icons/react/Users";


import { AudioReflexGame } from "@/components/app/audio-reflex-game";

import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { CardForm } from "@/components/app/card-form";
import { DeckForm } from "@/components/app/deck-form";
import { SingleCardView } from "@/components/app/single-card-view";
import { CardContextBlock } from "@/components/app/card-context-block";
import { EmptyState, ErrorState, RowSkeleton } from "@/components/app/states";
import {
  createCard,
  deleteCard,
  listCards,
  reorderCards,
  updateCard,
} from "@/lib/api/cards";
import {
  deleteDeck,
  getDeck,
  setDeckVisibility,
  updateDeck,
} from "@/lib/api/decks";
import { listTags } from "@/lib/api/tags";
import { ApiError } from "@/lib/api/client";
import type { CardResponse, DeckVisibility } from "@/lib/api/types";
import { useAsync } from "@/lib/use-async";
import { cn } from "@/lib/cn";

export function DeckDetailView({ deckId }: { deckId: number }) {
  const router = useRouter();
  const session = useSession();
  const [editingDeck, setEditingDeck] = useState(false);
  const [addingCard, setAddingCard] = useState(false);
  const [editingCardId, setEditingCardId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<"single" | "list" | "game">("single");
  const [gameSubMode, setGameSubMode] = useState<null | "solo">(null);
  const [singleCardIndex, setSingleCardIndex] = useState(0);
  const [rowError, setRowError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const deck = useAsync(
    useCallback((signal: AbortSignal) => getDeck(deckId, signal), [deckId]),
    `deck-${deckId}`,
  );
  const cards = useAsync(
    useCallback(
      (signal: AbortSignal) => listCards(deckId, 0, 100, signal),
      [deckId],
    ),
    `cards-${deckId}`,
  );
  const tags = useAsync(
    useCallback((signal: AbortSignal) => listTags(signal), []),
    "tags",
  );

  const isOwner = Boolean(
    session?.user?.id &&
    deck.status === "success" &&
    String(session.user.id) === String(deck.data.profileId)
  );

  /** Wraps a write so every row action reports failure the same way. */
  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setRowError(null);
    try {
      await action();
    } catch (error) {
      setRowError(
        error instanceof ApiError
          ? error.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  /**
   * Moves one card and renumbers the whole list. The endpoint takes the full
   * ordering, so sending only the moved card would leave gaps behind.
   */
  async function move(index: number, direction: -1 | 1) {
    if (cards.status !== "success") return;
    const ordered = [...cards.data.content];
    const target = index + direction;
    if (target < 0 || target >= ordered.length) return;

    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];

    await run(async () => {
      await reorderCards(
        deckId,
        ordered.map((card, position) => ({
          cardId: card.id,
          newPosition: position + 1,
        })),
      );
      cards.reload();
    });
  }

  async function onVisibilityChange(visibility: DeckVisibility) {
    await run(async () => {
      await setDeckVisibility(deckId, visibility);
      deck.reload();
    });
  }

  async function onDeleteCard(card: CardResponse) {
    if (!window.confirm(`Delete the card "${card.word}"?`)) return;
    await run(async () => {
      await deleteCard(card.id);
      cards.reload();
    });
  }

  async function onDeleteDeck() {
    if (deck.status !== "success") return;
    if (!window.confirm(`Delete "${deck.data.title}" and every card in it?`)) {
      return;
    }
    await run(async () => {
      await deleteDeck(deckId);
      router.replace("/decks");
    });
  }

  return (
    <Container size="wide">
      {deck.status === "loading" ? (
        <div className="h-16 animate-pulse rounded-2xl border border-line bg-surface-2 motion-reduce:animate-none" />
      ) : null}

      {deck.status === "error" ? (
        <div className="mb-4">
          <ErrorState message={deck.error} onRetry={deck.reload} />
        </div>
      ) : null}

      {deck.status === "success" && editingDeck ? (
        <div className="mb-6">
          <DeckForm
            deck={deck.data}
            tags={tags.data ?? []}
            submitLabel="Save deck"
            onCancel={() => setEditingDeck(false)}
            onSubmit={async (request, coverImage) => {
              await updateDeck(deckId, request, coverImage);
              setEditingDeck(false);
              deck.reload();
            }}
          />
        </div>
      ) : null}

      <section className="-mt-4 md:-mt-6" aria-labelledby="cards-title">
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          {/* Tiêu đề & All Decks navigation - trái */}
          <div className="flex items-center gap-3">
            <Link
              href="/decks"
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-surface-2 hover:text-ink"
              title="Về danh sách deck"
            >
              <ArrowLeft aria-hidden size={14} />
              <span className="hidden sm:inline">Decks</span>
            </Link>

            <h2 id="cards-title" className="text-xl font-semibold tracking-tight">
              Cards
              {cards.status === "success" ? (
                <span className="ml-2 font-mono text-base text-muted">
                  {cards.data.totalElements}
                </span>
              ) : null}
            </h2>
          </div>

          {/* View Mode Switcher — căn giữa */}
          {cards.status === "success" && cards.data.content.length > 0 ? (
            <div className="absolute left-1/2 -translate-x-1/2 hidden md:flex items-center gap-1 rounded-full border border-line bg-surface-2 p-1 text-xs font-medium shadow-sm">
              <button
                type="button"
                onClick={() => { setAddingCard(false); setViewMode("list"); setGameSubMode(null); }}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-1 transition-colors",
                  !addingCard && viewMode === "list"
                    ? "bg-surface text-ink shadow-sm"
                    : "text-muted hover:text-ink",
                )}
              >
                <List size={14} />
                Quản lý card
              </button>
              <button
                type="button"
                onClick={() => { setAddingCard(false); setViewMode("single"); setGameSubMode(null); }}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-1 transition-colors",
                  !addingCard && viewMode === "single"
                    ? "bg-surface text-ink shadow-sm"
                    : "text-muted hover:text-ink",
                )}
              >
                <CardsIcon size={14} />
                Xem card
              </button>
              <button
                type="button"
                onClick={() => { setAddingCard(false); setViewMode("game"); setGameSubMode(null); }}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-1 transition-colors",
                  !addingCard && viewMode === "game"
                    ? "bg-accent text-accent-fg shadow-sm"
                    : "text-muted hover:text-ink",
                )}
              >
                <GameController size={14} />
                Chơi game
              </button>
            </div>
          ) : null}

          {/* Action buttons (Add card) — phải */}
          <div className="flex items-center gap-2">
            {!addingCard ? (
              <Button onClick={() => setAddingCard(true)} disabled={busy}>
                <Plus aria-hidden size={15} weight="bold" />
                Add card
              </Button>
            ) : null}
          </div>
        </div>

        {/* View Mode Switcher cho màn hình nhỏ (Mobile) */}
        {cards.status === "success" && cards.data.content.length > 0 ? (
          <div className="mt-3 flex md:hidden items-center justify-center gap-1 rounded-full border border-line bg-surface-2 p-1 text-xs font-medium shadow-sm">
            <button
              type="button"
              onClick={() => { setAddingCard(false); setViewMode("list"); setGameSubMode(null); }}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 rounded-full px-3 py-1.5 transition-colors",
                !addingCard && viewMode === "list"
                  ? "bg-surface text-ink shadow-sm"
                  : "text-muted hover:text-ink",
              )}
            >
              <List size={14} />
              Quản lý card
            </button>
            <button
              type="button"
              onClick={() => { setAddingCard(false); setViewMode("single"); setGameSubMode(null); }}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 rounded-full px-3 py-1.5 transition-colors",
                !addingCard && viewMode === "single"
                  ? "bg-surface text-ink shadow-sm"
                  : "text-muted hover:text-ink",
              )}
            >
              <CardsIcon size={14} />
              Xem card
            </button>
            <button
              type="button"
              onClick={() => { setAddingCard(false); setViewMode("game"); setGameSubMode(null); }}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 rounded-full px-3 py-1.5 transition-colors",
                !addingCard && viewMode === "game"
                  ? "bg-accent text-accent-fg shadow-sm"
                  : "text-muted hover:text-ink",
              )}
            >
              <GameController size={14} />
              Chơi game
            </button>
          </div>
        ) : null}

        {rowError ? (
          <div className="mt-4">
            <ErrorState message={rowError} />
          </div>
        ) : null}

        {addingCard ? (
          <div className="mt-6">
            <CardForm
              submitLabel="Add card"
              onCancel={() => setAddingCard(false)}
              onSubmit={async (request, files) => {
                await createCard(
                  deckId,
                  {
                    ...request,
                    position:
                      cards.status === "success"
                        ? cards.data.content.length + 1
                        : 1,
                  },
                  files,
                );
                setAddingCard(false);
                cards.reload();
              }}
            />
          </div>
        ) : (
          <div className="mt-3">
          {cards.status === "loading" ? <RowSkeleton /> : null}

          {cards.status === "error" ? (
            <ErrorState message={cards.error} onRetry={cards.reload} />
          ) : null}

          {cards.status === "success" && cards.data.content.length === 0 ? (
            <EmptyState
              title="No cards in this deck"
              body="Add the first word you want to remember. A card needs a word and what it means; everything else is optional."
              action={
                !addingCard ? (
                  <Button onClick={() => setAddingCard(true)}>Add a card</Button>
                ) : null
              }
            />
          ) : null}

          {cards.status === "success" && cards.data.content.length > 0 ? (
            editingCardId ? (
              <div className="mb-6">
                <CardForm
                  card={cards.data.content.find((c) => c.id === editingCardId)}
                  submitLabel="Save card"
                  onCancel={() => setEditingCardId(null)}
                  onSubmit={async (request, files) => {
                    await updateCard(editingCardId, request, files);
                    setEditingCardId(null);
                    cards.reload();
                  }}
                />
              </div>
            ) : viewMode === "game" ? (
              gameSubMode === "solo" ? (
                <AudioReflexGame
                  deckId={deckId}
                  deckTitle={deck.status === "success" ? deck.data.title : ""}
                />
              ) : (
                // Màn chọn chế độ chơi
                <div className="flex flex-col items-center gap-4 pt-4 pb-8">
                  <div className="flex size-14 items-center justify-center rounded-full bg-accent/10 text-accent">
                    <GameController size={30} weight="fill" />
                  </div>
                  <h3 className="text-xl font-bold tracking-tight text-ink">Chọn chế độ chơi</h3>

                  <div className="flex flex-row gap-3">
                    {/* Solo */}
                    <button
                      type="button"
                      onClick={() => setGameSubMode("solo")}
                      className="group flex items-center gap-3 rounded-2xl border border-line bg-surface px-5 py-3.5 text-left transition-all hover:border-accent/50 hover:bg-accent/5 hover:shadow-md active:scale-[0.98]"
                    >
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent group-hover:bg-accent group-hover:text-accent-fg transition-colors">
                        <GameController size={18} weight="fill" />
                      </div>
                      <span className="whitespace-nowrap font-semibold text-ink text-sm">Chơi Solo</span>
                    </button>

                    {/* Với bạn bè - đang phát triển */}
                    <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface/50 px-5 py-3.5 opacity-55 cursor-not-allowed select-none">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-muted">
                        <Users size={18} weight="fill" />
                      </div>
                      <span className="whitespace-nowrap font-semibold text-ink text-sm">Với bạn bè</span>
                      <span className="whitespace-nowrap rounded-full bg-amber-500/15 px-2 py-0.5 text-[0.6rem] font-bold text-amber-600 dark:text-amber-400">Sắp ra mắt</span>
                    </div>
                  </div>
                </div>

              )
            ) : viewMode === "single" ? (

              <SingleCardView
                key={singleCardIndex}
                cards={cards.data.content}
                currentIndex={
                  singleCardIndex >= cards.data.content.length
                    ? 0
                    : singleCardIndex
                }
                onIndexChange={setSingleCardIndex}
                onEditCard={(card) => setEditingCardId(card.id)}
                busy={busy}
              />
            ) : (
              <ul className="flex flex-col gap-3">
                {cards.data.content.map((card, index) => (
                  <li key={card.id}>
                    <article className="flex items-start gap-4 rounded-card border border-line bg-surface p-5">
                      <span className="mt-0.5 font-mono text-sm text-muted tabular-nums">
                        {card.position}
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                          <h3 className="text-lg font-semibold tracking-tight">
                            {card.word}
                          </h3>
                          {card.phonetic ? (
                            <span className="font-mono text-sm text-muted">
                              {card.phonetic}
                            </span>
                          ) : null}
                          {card.partOfSpeech ? (
                            <span className="rounded-full border border-line px-2 py-0.5 text-xs text-muted">
                              {card.partOfSpeech}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-base">{card.meaning}</p>
                        {card.exampleSentence || card.exampleMeaning ? (
                          <div className="mt-3">
                            <CardContextBlock
                              exampleSentence={card.exampleSentence}
                              exampleMeaning={card.exampleMeaning}
                              compact
                            />
                          </div>
                        ) : null}
                      </div>

                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => move(index, -1)}
                          disabled={busy || index === 0}
                          aria-label={`Move ${card.word} up`}
                          className="rounded-full p-2 text-muted transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-40"
                        >
                          <ArrowUp aria-hidden size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => move(index, 1)}
                          disabled={
                            busy || index === cards.data.content.length - 1
                          }
                          aria-label={`Move ${card.word} down`}
                          className="rounded-full p-2 text-muted transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-40"
                        >
                          <ArrowDown aria-hidden size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingCardId(card.id)}
                          disabled={busy}
                          aria-label={`Edit ${card.word}`}
                          className="rounded-full p-2 text-muted transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-40"
                        >
                          <PencilSimple aria-hidden size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteCard(card)}
                          disabled={busy}
                          aria-label={`Delete ${card.word}`}
                          className="rounded-full p-2 text-muted transition-colors hover:bg-surface-2 hover:text-danger disabled:opacity-40"
                        >
                          <Trash aria-hidden size={15} />
                        </button>
                      </div>
                    </article>
                  </li>
                ))}
              </ul>
            )
          ) : null}
        </div>
      )}
    </section>
  </Container>
);
}
