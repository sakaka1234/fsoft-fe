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
import { UserPlus } from "@phosphor-icons/react/UserPlus";


import { AudioReflexGame } from "@/components/app/audio-reflex-game";
import { AudioReflexMultiplayer } from "@/components/app/audio-reflex-multiplayer";

import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Modal } from "@/components/ui/modal";
import { CardForm } from "@/components/app/card-form";
import { DeckForm } from "@/components/app/deck-form";
import { SingleCardView } from "@/components/app/single-card-view";
import { CardContextBlock } from "@/components/app/card-context-block";
import { DeckSharePanel } from "@/components/app/deck-share-panel";
import { VISIBILITY_LABEL } from "@/components/app/deck-card";
import { EmptyState, ErrorState, RowSkeleton, SingleCardSkeleton } from "@/components/app/states";
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

function DeckDetailCover({ src, alt }: { src: string; alt: string }) {
  const [hasError, setHasError] = useState(false);
  const cleanSrc = src?.trim();
  if (
    hasError ||
    !cleanSrc ||
    cleanSrc === "" ||
    cleanSrc === "null" ||
    cleanSrc === "undefined"
  ) {
    return null;
  }

  return (
    <div className="h-28 w-28 sm:h-36 sm:w-36 shrink-0 overflow-hidden rounded-2xl border border-line bg-surface-2 shadow-sm">
      <img
        src={cleanSrc}
        alt={alt}
        onError={() => setHasError(true)}
        className="h-full w-full object-cover"
      />
    </div>
  );
}

export function DeckDetailView({ deckId }: { deckId: number }) {
  const router = useRouter();
  const session = useSession();
  const [editingDeck, setEditingDeck] = useState(false);
  const [addingCard, setAddingCard] = useState(false);
  const [editingCardId, setEditingCardId] = useState<number | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"single" | "list" | "game">("single");
  const [gameSubMode, setGameSubMode] = useState<null | "solo" | "multiplayer">(null);
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

      {deck.status === "success" && !editingDeck ? (
        <div className="relative mb-8 md:mb-10 overflow-hidden rounded-3xl border border-line bg-surface p-5 sm:p-6 md:p-7 shadow-sm">
          {/* Top-right action icons for Owner */}
          {isOwner ? (
            <div className="absolute top-4 right-4 flex items-center gap-1 z-10">
              <button
                type="button"
                onClick={() => setEditingDeck(true)}
                className="rounded-full p-2 text-muted transition-colors hover:bg-surface-2 hover:text-ink"
                title="Chỉnh sửa thông tin bộ thẻ"
                aria-label="Chỉnh sửa thông tin bộ thẻ"
              >
                <PencilSimple size={18} />
              </button>
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(true)}
                className="rounded-full p-2 text-muted transition-colors hover:bg-danger/10 hover:text-danger"
                title="Xóa bộ thẻ này"
                aria-label="Xóa bộ thẻ này"
              >
                <Trash size={18} />
              </button>
            </div>
          ) : null}

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 pr-16 sm:pr-20">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
              {deck.data.coverImageUrl ? (
                <DeckDetailCover
                  src={deck.data.coverImageUrl}
                  alt={deck.data.title}
                />
              ) : null}

              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-line bg-surface-2 px-2.5 py-0.5 text-xs font-mono font-semibold uppercase text-muted">
                    {deck.data.sourceLanguage} to {deck.data.targetLanguage}
                  </span>
                  <span className="rounded-full border border-line bg-surface-2 px-2.5 py-0.5 text-xs font-medium text-muted">
                    {VISIBILITY_LABEL[deck.data.visibility] ?? deck.data.visibility}
                  </span>
                </div>

                <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl md:text-4xl">
                  {deck.data.title}
                </h1>

                {deck.data.description ? (
                  <p className="max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
                    {deck.data.description}
                  </p>
                ) : null}

                {deck.data.tags.length > 0 ? (
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {deck.data.tags.map((tag) => (
                      <span
                        key={tag.id}
                        className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent-text"
                      >
                        {tag.name}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <section className="mt-2 md:mt-4" aria-labelledby="cards-title">
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
            <div className="absolute left-1/2 -translate-x-1/2 hidden md:flex h-10 items-center gap-1 rounded-full border border-line bg-surface-2 p-1 text-sm font-medium shadow-sm">
              <button
                type="button"
                onClick={() => { setAddingCard(false); setViewMode("list"); setGameSubMode(null); }}
                className={cn(
                  "flex h-8 items-center gap-1.5 rounded-full px-3.5 transition-colors",
                  !addingCard && viewMode === "list"
                    ? "bg-surface text-ink shadow-sm"
                    : "text-muted hover:text-ink",
                )}
              >
                <List size={16} />
                Quản lý card
              </button>
              <button
                type="button"
                onClick={() => { setAddingCard(false); setViewMode("single"); setGameSubMode(null); }}
                className={cn(
                  "flex h-8 items-center gap-1.5 rounded-full px-3.5 transition-colors",
                  !addingCard && viewMode === "single"
                    ? "bg-surface text-ink shadow-sm"
                    : "text-muted hover:text-ink",
                )}
              >
                <CardsIcon size={16} />
                Xem card
              </button>
              <button
                type="button"
                onClick={() => { setAddingCard(false); setViewMode("game"); setGameSubMode(null); }}
                className={cn(
                  "flex h-8 items-center gap-1.5 rounded-full px-3.5 transition-colors",
                  !addingCard && viewMode === "game"
                    ? "bg-accent text-accent-fg shadow-sm"
                    : "text-muted hover:text-ink",
                )}
              >
                <GameController size={16} />
                Chơi game
              </button>
            </div>
          ) : null}

          {/* Action buttons (Share card luôn có; Add card nằm cạnh khi ở Quản lý card) — phải */}
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => setIsShareModalOpen(true)}
              disabled={busy}
            >
              <UserPlus aria-hidden size={15} weight="bold" />
              Share card
            </Button>

            {viewMode === "list" && !addingCard ? (
              <Button onClick={() => setAddingCard(true)} disabled={busy}>
                <Plus aria-hidden size={15} weight="bold" />
                Add card
              </Button>
            ) : null}
          </div>
        </div>

        {/* View Mode Switcher cho màn hình nhỏ (Mobile) */}
        {cards.status === "success" && cards.data.content.length > 0 ? (
          <div className="mt-3 flex md:hidden items-center justify-center gap-1 rounded-full border border-line bg-surface-2 p-1 text-sm font-medium shadow-sm">
            <button
              type="button"
              onClick={() => { setAddingCard(false); setViewMode("list"); setGameSubMode(null); }}
              className={cn(
                "flex-1 flex h-8 items-center justify-center gap-1.5 rounded-full px-3 transition-colors",
                !addingCard && viewMode === "list"
                  ? "bg-surface text-ink shadow-sm"
                  : "text-muted hover:text-ink",
              )}
            >
              <List size={16} />
              Quản lý card
            </button>
            <button
              type="button"
              onClick={() => { setAddingCard(false); setViewMode("single"); setGameSubMode(null); }}
              className={cn(
                "flex-1 flex h-8 items-center justify-center gap-1.5 rounded-full px-3 transition-colors",
                !addingCard && viewMode === "single"
                  ? "bg-surface text-ink shadow-sm"
                  : "text-muted hover:text-ink",
              )}
            >
              <CardsIcon size={16} />
              Xem card
            </button>
            <button
              type="button"
              onClick={() => { setAddingCard(false); setViewMode("game"); setGameSubMode(null); }}
              className={cn(
                "flex-1 flex h-8 items-center justify-center gap-1.5 rounded-full px-3 transition-colors",
                !addingCard && viewMode === "game"
                  ? "bg-accent text-accent-fg shadow-sm"
                  : "text-muted hover:text-ink",
              )}
            >
              <GameController size={16} />
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
          {cards.status === "loading" ? (
            viewMode === "single" ? (
              <SingleCardSkeleton />
            ) : (
              <RowSkeleton count={4} />
            )
          ) : null}

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
                <div>
                  <div className="mb-4 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setGameSubMode(null)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-ink transition-colors cursor-pointer"
                    >
                      <ArrowLeft size={14} /> Chuyển chế độ game
                    </button>
                  </div>
                  <AudioReflexGame deckId={deckId} deckTitle={deck.data?.title ?? ""} />
                </div>
              ) : gameSubMode === "multiplayer" ? (
                <div>
                  <div className="mb-4 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setGameSubMode(null)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-ink transition-colors cursor-pointer"
                    >
                      <ArrowLeft size={14} /> Chuyển chế độ game
                    </button>
                  </div>
                  <AudioReflexMultiplayer deckId={deckId} deckTitle={deck.data?.title ?? ""} onBackToSolo={() => setGameSubMode(null)} />
                </div>
              ) : (
                <div className="max-w-xl mx-auto flex flex-col gap-6 py-6 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <GameController size={42} className="text-accent" weight="fill" />
                    <h3 className="text-2xl font-extrabold text-ink">Chọn Chế Độ Chơi Game</h3>
                    <p className="text-sm text-muted">Lựa chọn luyện tập phản xạ nghe 1 người hoặc thi đấu cùng bạn bè</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                    <button
                      type="button"
                      onClick={() => setGameSubMode("solo")}
                      className="group flex flex-col items-center justify-between p-6 rounded-3xl border border-line bg-surface hover:border-accent hover:shadow-lg transition-all cursor-pointer text-center"
                    >
                      <div className="flex size-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500 group-hover:scale-110 transition-transform">
                        <GameController size={32} weight="fill" />
                      </div>
                      <div className="mt-4">
                        <h4 className="font-bold text-ink text-base">Chơi Đơn (Solo)</h4>
                        <p className="text-xs text-muted mt-1">Luyện phản xạ 1 người, tích lũy điểm combo & leo bảng xếp hạng</p>
                      </div>
                      <span className="mt-4 w-full py-2.5 rounded-full bg-surface-2 text-xs font-semibold text-ink group-hover:bg-accent group-hover:text-accent-fg transition-colors">
                        Vào Chơi Đơn
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setGameSubMode("multiplayer")}
                      className="group flex flex-col items-center justify-between p-6 rounded-3xl border border-line bg-surface hover:border-indigo-500 hover:shadow-lg transition-all cursor-pointer text-center"
                    >
                      <div className="flex size-14 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-500 group-hover:scale-110 transition-transform">
                        <Users size={32} weight="fill" />
                      </div>
                      <div className="mt-4">
                        <h4 className="font-bold text-ink text-base">Chơi Với Bạn Bè</h4>
                        <p className="text-xs text-muted mt-1">Tạo phòng riêng tư 6 ký tự hoặc nhập mã để thi đấu real-time</p>
                      </div>
                      <span className="mt-4 w-full py-2.5 rounded-full bg-surface-2 text-xs font-semibold text-ink group-hover:bg-indigo-500 group-hover:text-white transition-colors">
                        Vào Thi Đấu
                      </span>
                    </button>
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

    {/* Share Card Modal */}
    <Modal
      isOpen={isShareModalOpen}
      onClose={() => setIsShareModalOpen(false)}
      title="Chia sẻ bộ card"
    >
      {isOwner ? (
        <DeckSharePanel deckId={deckId} compact />
      ) : (
        <p className="py-6 text-center text-sm text-muted">
          Chỉ chủ sở hữu bộ card mới có thể phân quyền chia sẻ.
        </p>
      )}
    </Modal>

    {/* Delete Deck Modal */}
    <Modal
      isOpen={isDeleteModalOpen}
      onClose={() => setIsDeleteModalOpen(false)}
      title="Xác nhận xóa bộ thẻ"
    >
      <div className="flex flex-col gap-4 py-2">
        <p className="text-sm leading-relaxed text-muted">
          Bạn có chắc chắn muốn xóa bộ thẻ{" "}
          <strong className="text-ink font-semibold">
            &quot;{deck.status === "success" ? deck.data.title : ""}&quot;
          </strong>{" "}
          cùng toàn bộ các thẻ từ vựng bên trong không? Hành động này{" "}
          <strong className="text-danger font-semibold">không thể hoàn tác</strong>.
        </p>

        <div className="mt-4 flex justify-end gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setIsDeleteModalOpen(false)}
            disabled={busy}
          >
            Hủy
          </Button>
          <button
            type="button"
            onClick={async () => {
              if (deck.status !== "success") return;
              await run(async () => {
                await deleteDeck(deckId);
                setIsDeleteModalOpen(false);
                router.replace("/decks");
              });
            }}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-full bg-danger px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-danger/90 disabled:opacity-50"
          >
            <Trash size={16} />
            {busy ? "Đang xóa..." : "Xóa bộ thẻ"}
          </button>
        </div>
      </div>
    </Modal>
  </Container>
);
}
