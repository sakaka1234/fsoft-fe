"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown } from "@phosphor-icons/react/ArrowDown";
import { ArrowLeft } from "@phosphor-icons/react/ArrowLeft";
import { ArrowUp } from "@phosphor-icons/react/ArrowUp";
import { PencilSimple } from "@phosphor-icons/react/PencilSimple";
import { Plus } from "@phosphor-icons/react/Plus";
import { Trash } from "@phosphor-icons/react/Trash";

import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { CardForm } from "@/components/app/card-form";
import { DeckForm } from "@/components/app/deck-form";
import { EmptyState, ErrorState, RowSkeleton } from "@/components/app/states";
import {
  createCard,
  deleteCard,
  listCards,
  reorderCards,
  updateCard,
} from "@/lib/api/cards";
import { deleteDeck, getDeck, updateDeck } from "@/lib/api/decks";
import { listTags } from "@/lib/api/tags";
import { ApiError } from "@/lib/api/client";
import type { CardResponse } from "@/lib/api/types";
import { useAsync } from "@/lib/use-async";

export function DeckDetailView({ deckId }: { deckId: number }) {
  const router = useRouter();
  const [editingDeck, setEditingDeck] = useState(false);
  const [addingCard, setAddingCard] = useState(false);
  const [editingCardId, setEditingCardId] = useState<number | null>(null);
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
      <Link
        href="/decks"
        className="inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-ink"
      >
        <ArrowLeft aria-hidden size={15} />
        All decks
      </Link>

      {deck.status === "loading" ? (
        <div className="mt-6 h-28 animate-pulse rounded-card border border-line bg-surface-2 motion-reduce:animate-none" />
      ) : null}

      {deck.status === "error" ? (
        <div className="mt-6">
          <ErrorState message={deck.error} onRetry={deck.reload} />
        </div>
      ) : null}

      {deck.status === "success" ? (
        <div className="mt-6">
          {editingDeck ? (
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
          ) : (
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
                  {deck.data.title}
                </h1>
                {deck.data.description ? (
                  <p className="mt-2 max-w-[62ch] text-base leading-relaxed text-muted">
                    {deck.data.description}
                  </p>
                ) : null}
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted">
                  <span className="font-mono uppercase">
                    {deck.data.sourceLanguage} to {deck.data.targetLanguage}
                  </span>
                  <span className="rounded-full border border-line px-2.5 py-0.5 text-xs">
                    {deck.data.visibility}
                  </span>
                  {deck.data.tags.map((tag) => (
                    <span
                      key={tag.id}
                      className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs text-accent-text"
                    >
                      {tag.name}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={() => setEditingDeck(true)}
                  disabled={busy}
                >
                  <PencilSimple aria-hidden size={15} />
                  Edit
                </Button>
                <Button
                  variant="secondary"
                  onClick={onDeleteDeck}
                  disabled={busy}
                >
                  <Trash aria-hidden size={15} />
                  Delete
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : null}

      <section className="mt-12" aria-labelledby="cards-title">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 id="cards-title" className="text-xl font-semibold tracking-tight">
            Cards
            {cards.status === "success" ? (
              <span className="ml-2 font-mono text-base text-muted">
                {cards.data.totalElements}
              </span>
            ) : null}
          </h2>
          {!addingCard ? (
            <Button onClick={() => setAddingCard(true)} disabled={busy}>
              <Plus aria-hidden size={16} weight="bold" />
              Add card
            </Button>
          ) : null}
        </div>

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
        ) : null}

        <div className="mt-6">
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
            <ul className="flex flex-col gap-3">
              {cards.data.content.map((card, index) => (
                <li key={card.id}>
                  {editingCardId === card.id ? (
                    <CardForm
                      card={card}
                      submitLabel="Save card"
                      onCancel={() => setEditingCardId(null)}
                      onSubmit={async (request, files) => {
                        await updateCard(card.id, request, files);
                        setEditingCardId(null);
                        cards.reload();
                      }}
                    />
                  ) : (
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
                        {card.exampleSentence ? (
                          <p className="mt-2 text-sm text-muted">
                            {card.exampleSentence}
                          </p>
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
                  )}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </section>
    </Container>
  );
}
