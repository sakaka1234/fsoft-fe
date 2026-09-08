"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { ButtonLink } from "@/components/ui/button-link";
import { Container } from "@/components/ui/container";
import { TextInput } from "@/components/ui/field";
import { EmptyState, ErrorState, RowSkeleton } from "@/components/app/states";
import { AudioReflexGame } from "@/components/app/audio-reflex-game";
import { AudioReflexMultiplayer } from "@/components/app/audio-reflex-multiplayer";
import { SpaceStrikerMultiplayer } from "@/components/app/space-striker-multiplayer";
import { listCards } from "@/lib/api/cards";
import { listMyDecks } from "@/lib/api/decks";
import type { DeckResponse } from "@/lib/api/types";
import { useAsync } from "@/lib/use-async";

import { ArrowLeft } from "@phosphor-icons/react/ArrowLeft";
import { CaretRight } from "@phosphor-icons/react/CaretRight";
import { GameController } from "@phosphor-icons/react/GameController";
import { Rocket } from "@phosphor-icons/react/Rocket";
import { UserPlus } from "@phosphor-icons/react/UserPlus";
import { Users } from "@phosphor-icons/react/Users";
import { Sparkle } from "@phosphor-icons/react/Sparkle";
import { MagnifyingGlass } from "@phosphor-icons/react/MagnifyingGlass";
import { Cards } from "@phosphor-icons/react/Cards";
import { Lightning } from "@phosphor-icons/react/Lightning";

/*
  Chơi game như một điểm đến riêng, không phải một tab nằm trong bộ thẻ.

  Trang bộ thẻ vẫn giữ nguyên tab Chơi game của nó: ở đó bộ thẻ đã biết rồi nên
  bấm một lần là vào trận. Trang này lo trường hợp ngược lại, khi người chơi
  chưa nghĩ ra sẽ chơi bộ nào, và bắt đầu bằng câu hỏi "chơi kiểu gì".
*/

const GAME_MODES = [
  {
    key: "solo" as const,
    title: "Chơi một mình",
    body: "Luyện phản xạ nghe, cộng điểm combo và leo bảng xếp hạng cá nhân.",
    Icon: GameController,
    multiplayer: false,
    tag: "Cá nhân",
    badgeColor: "bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400",
  },
  {
    key: "multiplayer" as const,
    title: "Thi đấu với bạn bè",
    body: "Tạo phòng 6 ký tự hoặc nhập mã để thách đấu trực tiếp phản xạ âm thanh.",
    Icon: Users,
    multiplayer: true,
    tag: "Phòng 6 số",
    badgeColor: "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400",
  },
  {
    key: "space-striker" as const,
    title: "Space Striker",
    body: "Lái phi thuyền bắn từ vựng theo thời gian thực. Ai bắn đúng trước ghi điểm!",
    Icon: Rocket,
    multiplayer: true,
    tag: "Đến 6 người",
    badgeColor: "bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400",
  },
];

type GameMode = (typeof GAME_MODES)[number]["key"];

const DECK_PAGE_SIZE = 50;

export function GamesView() {
  const [mode, setMode] = useState<GameMode | null>(null);
  const [deck, setDeck] = useState<DeckResponse | null>(null);
  const [joinByCode, setJoinByCode] = useState(false);

  const chosenMode = GAME_MODES.find((m) => m.key === mode) ?? null;

  function pickMode(next: GameMode) {
    setJoinByCode(false);
    setMode(next);
  }

  function backToModes() {
    setJoinByCode(false);
    setMode(null);
  }

  return (
    <Container className="flex flex-col gap-8 py-8 sm:py-10 max-w-5xl">
      {/* Hero Header */}
      <header className="relative overflow-hidden rounded-3xl border border-line/60 bg-surface p-6 sm:p-8 shadow-sm">
        <div className="absolute -right-10 -top-10 size-48 rounded-full bg-accent/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent-soft px-3 py-1 text-xs font-semibold text-accent-text">
              <Sparkle size={14} className="text-accent" weight="fill" />
              <span>Gamer Zone</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Chơi Game & Luyện Tập</h1>
            <p className="text-sm sm:text-base text-muted leading-relaxed">
              Tăng tốc khả năng phản xạ và ghi nhớ từ vựng thông qua minigame tương tác. Chọn kiểu chơi và bộ thẻ để bắt đầu thi đấu ngay!
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="flex -space-x-2">
              <div className="flex size-10 items-center justify-center rounded-full bg-indigo-500/10 text-indigo-500 border-2 border-surface shadow-sm">
                <GameController size={20} weight="fill" />
              </div>
              <div className="flex size-10 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 border-2 border-surface shadow-sm">
                <Users size={20} weight="fill" />
              </div>
              <div className="flex size-10 items-center justify-center rounded-full bg-purple-500/10 text-purple-500 border-2 border-surface shadow-sm">
                <Rocket size={20} weight="fill" />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Stepper Progress Bar */}
      <div className="flex items-center justify-center gap-2 sm:gap-4 py-1 text-xs font-semibold">
        <div className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all ${
          mode === null 
            ? "bg-accent text-paper shadow-sm" 
            : "bg-surface-2 text-muted"
        }`}>
          <span className="flex size-5 items-center justify-center rounded-full bg-paper/20 text-[10px]">1</span>
          <span>1. Chọn chế độ</span>
        </div>

        <CaretRight size={14} className="text-muted/40" />

        <div className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all ${
          mode !== null && deck === null && !joinByCode
            ? "bg-accent text-paper shadow-sm" 
            : mode !== null 
              ? "bg-accent-soft text-accent-text"
              : "bg-surface-2 text-muted"
        }`}>
          <span className="flex size-5 items-center justify-center rounded-full bg-paper/20 text-[10px]">2</span>
          <span>2. Chọn bộ thẻ</span>
        </div>

        <CaretRight size={14} className="text-muted/40" />

        <div className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all ${
          deck !== null || joinByCode
            ? "bg-accent text-paper shadow-sm" 
            : "bg-surface-2 text-muted"
        }`}>
          <span className="flex size-5 items-center justify-center rounded-full bg-paper/20 text-[10px]">3</span>
          <span>3. Vào trận đấu</span>
        </div>
      </div>

      {mode === null ? (
        <ModePicker onPick={pickMode} />
      ) : deck === null && !joinByCode ? (
        <DeckPicker
          modeTitle={chosenMode?.title ?? ""}
          canJoinByCode={chosenMode?.multiplayer ?? false}
          onBack={backToModes}
          onPick={setDeck}
          onJoinByCode={() => setJoinByCode(true)}
        />
      ) : (
        <PlayArea
          mode={mode}
          deck={deck}
          onChangeMode={backToModes}
          onChangeDeck={() => {
            setJoinByCode(false);
            setDeck(null);
          }}
        />
      )}
    </Container>
  );
}

/* ------------------------------ bước 1: kiểu chơi ------------------------ */

function ModePicker({ onPick }: { onPick: (mode: GameMode) => void }) {
  return (
    <section className="space-y-6">
      <div className="text-center max-w-md mx-auto space-y-1">
        <h2 className="text-xl font-bold tracking-tight">Chọn chế độ chơi</h2>
        <p className="text-sm text-muted">
          Mỗi kiểu chơi có luật riêng giúp bạn rèn luyện trí nhớ hiệu quả nhất.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {GAME_MODES.map(({ key, title, body, Icon, tag, badgeColor }) => (
          <button
            key={key}
            type="button"
            onClick={() => onPick(key)}
            className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-line bg-surface p-6 text-left transition-all duration-200 hover:-translate-y-1 hover:border-accent hover:shadow-xl hover:shadow-accent/5"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className={`flex size-14 items-center justify-center rounded-2xl ${badgeColor} transition-transform duration-200 group-hover:scale-110`}>
                  <Icon size={28} weight="fill" />
                </div>
                <span className="rounded-full bg-surface-2 px-3 py-1 text-xs font-semibold text-muted group-hover:bg-accent-soft group-hover:text-accent-text transition-colors">
                  {tag}
                </span>
              </div>
              <div className="space-y-1.5">
                <h3 className="text-lg font-bold tracking-tight group-hover:text-accent transition-colors">
                  {title}
                </h3>
                <p className="text-sm text-muted leading-relaxed">{body}</p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between border-t border-line/60 pt-4 text-xs font-semibold text-accent-text">
              <span className="flex items-center gap-1">
                <Lightning size={14} weight="fill" />
                Bắt đầu ngay
              </span>
              <CaretRight size={16} className="transition-transform duration-200 group-hover:translate-x-1" />
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------ bước 2: bộ thẻ --------------------------- */

function DeckPicker({
  modeTitle,
  canJoinByCode,
  onBack,
  onPick,
  onJoinByCode,
}: {
  modeTitle: string;
  canJoinByCode: boolean;
  onBack: () => void;
  onPick: (deck: DeckResponse) => void;
  onJoinByCode: () => void;
}) {
  const [keyword, setKeyword] = useState("");

  const decks = useAsync(
    useCallback(
      (signal: AbortSignal) => listMyDecks(1, DECK_PAGE_SIZE, signal),
      [],
    ),
    "games-my-decks",
  );

  const rows = decks.status === "success" ? decks.data.content : null;

  const filtered = useMemo(() => {
    if (!rows) return null;
    const needle = keyword.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((deck) => deck.title.toLowerCase().includes(needle));
  }, [rows, keyword]);

  return (
    <section className="space-y-6 max-w-3xl mx-auto w-full">
      {/* Nav Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <BackLink onClick={onBack} label="Đổi cách chơi" />
        <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3.5 py-1.5 text-xs font-bold text-accent-text">
          <Sparkle size={14} weight="fill" />
          Chế độ: {modeTitle}
        </span>
      </div>

      <div className="space-y-1">
        <h2 className="text-xl font-bold tracking-tight">
          Chọn bộ thẻ để luyện tập
        </h2>
        <p className="text-sm text-muted">
          {canJoinByCode
            ? `${modeTitle} sử dụng bộ thẻ này nếu bạn là người chủ phòng.`
            : `${modeTitle} yêu cầu một bộ thẻ làm dữ liệu câu hỏi.`}
        </p>
      </div>

      {canJoinByCode ? (
        <button
          type="button"
          onClick={onJoinByCode}
          className="group relative flex w-full items-center gap-4 rounded-2xl border border-dashed border-accent/40 bg-accent-soft/30 p-4 sm:p-5 text-left transition-all hover:border-accent hover:bg-accent-soft/60"
        >
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-accent text-paper shadow-sm">
            <UserPlus aria-hidden size={24} weight="fill" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-bold text-base group-hover:text-accent transition-colors">
              Được bạn bè rủ vào phòng? Nhập mã ngay →
            </span>
            <span className="mt-0.5 block text-xs sm:text-sm text-muted">
              Không cần chọn bộ thẻ. Bạn sẽ chơi với bộ thẻ do chủ phòng thiết lập.
            </span>
          </span>
          <CaretRight aria-hidden size={18} className="shrink-0 text-muted transition-transform group-hover:translate-x-1" />
        </button>
      ) : null}

      {rows && rows.length > 0 ? (
        <div className="relative">
          <MagnifyingGlass
            aria-hidden
            size={18}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
          />
          <TextInput
            id="games-deck-search"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="Tìm theo tên bộ thẻ..."
            className="pl-10"
          />
        </div>
      ) : null}

      {decks.status === "loading" ? (
        <div className="mt-4">
          <RowSkeleton count={4} />
        </div>
      ) : null}

      {decks.status === "error" ? (
        <div className="mt-4">
          <ErrorState message={decks.error} onRetry={decks.reload} />
        </div>
      ) : null}

      {filtered ? (
        filtered.length === 0 ? (
          <div className="mt-4">
            {rows && rows.length > 0 ? (
              <EmptyState
                title="Không tìm thấy bộ thẻ"
                body="Thử đổi từ khoá tìm kiếm khác."
              />
            ) : (
              <EmptyState
                title="Bạn chưa có bộ thẻ nào"
                body="Tạo một bộ thẻ và thêm từ vựng vào đó, rồi quay lại đây để chơi."
                action={<ButtonLink href="/decks">Tới trang bộ thẻ</ButtonLink>}
              />
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {filtered.map((deck) => (
              <DeckPickerCardItem key={deck.id} deck={deck} onPick={onPick} />
            ))}
          </div>
        )
      ) : null}
    </section>
  );
}

function DeckPickerCardItem({
  deck,
  onPick,
}: {
  deck: DeckResponse;
  onPick: (deck: DeckResponse) => void;
}) {
  const [realTotal, setRealTotal] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    listCards(deck.id, 0, 1)
      .then((res) => {
        if (active && res && typeof res.totalElements === "number") {
          setRealTotal(res.totalElements);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [deck.id]);

  const displayTotal = realTotal ?? deck.totalCards;

  return (
    <button
      type="button"
      onClick={() => onPick(deck)}
      className="group relative flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4 text-left transition-all hover:border-accent hover:bg-surface-2 hover:shadow-md"
    >
      <div className="min-w-0 flex-1 space-y-1">
        <div className="font-bold text-base truncate group-hover:text-accent transition-colors">
          {deck.title}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          <span className="inline-flex items-center gap-1 rounded-md bg-surface-2 px-2 py-0.5 font-medium">
            {deck.sourceLanguage} → {deck.targetLanguage}
          </span>
          {displayTotal > 0 ? (
            <span className="inline-flex items-center gap-1 font-medium">
              <Cards size={13} className="text-muted" />
              {displayTotal} thẻ
            </span>
          ) : null}
        </div>
      </div>

      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-muted group-hover:bg-accent group-hover:text-paper transition-colors">
        <CaretRight aria-hidden size={16} />
      </span>
    </button>
  );
}

/* ------------------------------ bước 3: vào trận ------------------------- */

function PlayArea({
  mode,
  deck,
  onChangeMode,
  onChangeDeck,
}: {
  mode: GameMode;
  deck: DeckResponse | null;
  onChangeMode: () => void;
  onChangeDeck: () => void;
}) {
  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center gap-3 border-b border-line pb-4">
        <BackLink onClick={onChangeMode} label="Đổi cách chơi" />
        {deck ? (
          <button
            type="button"
            onClick={onChangeDeck}
            className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-xs font-semibold text-muted transition-colors hover:bg-surface-2 hover:text-ink"
          >
            Bộ thẻ hiện tại:{" "}
            <span className="font-bold text-ink">{deck.title}</span>
            <span className="text-accent hover:underline">(Đổi bộ thẻ)</span>
          </button>
        ) : (
          <span className="rounded-full bg-accent-soft px-3.5 py-1.5 text-xs font-bold text-accent-text">
            Đang vào phòng bằng mã 6 ký tự
          </span>
        )}
      </div>

      {deck ? (
        <DeckGame mode={mode} deck={deck} onChangeMode={onChangeMode} />
      ) : (
        <JoinByCodeGame mode={mode} onChangeMode={onChangeMode} />
      )}
    </section>
  );
}

function JoinByCodeGame({
  mode,
  onChangeMode,
}: {
  mode: GameMode;
  onChangeMode: () => void;
}) {
  return mode === "multiplayer" ? (
    <AudioReflexMultiplayer onBackToSolo={onChangeMode} />
  ) : (
    <SpaceStrikerMultiplayer onBackToSolo={onChangeMode} />
  );
}

function DeckGame({
  mode,
  deck,
  onChangeMode,
}: {
  mode: GameMode;
  deck: DeckResponse;
  onChangeMode: () => void;
}) {
  const cards = useAsync(
    useCallback(
      (signal: AbortSignal) => listCards(deck.id, 0, 100, signal),
      [deck.id],
    ),
    `cards-${deck.id}`,
  );

  const ready = cards.status === "success" && cards.data.content.length > 0;
  const empty = cards.status === "success" && cards.data.content.length === 0;

  return (
    <>
      {cards.status === "loading" ? <RowSkeleton count={3} /> : null}

      {cards.status === "error" ? (
        <ErrorState message={cards.error} onRetry={cards.reload} />
      ) : null}

      {empty ? (
        <EmptyState
          title="Bộ thẻ này chưa có thẻ nào"
          body="Game cần ít nhất một thẻ để dựng câu hỏi. Thêm từ vựng vào bộ thẻ rồi quay lại đây."
          action={<ButtonLink href={`/decks/${deck.id}`}>Mở bộ thẻ</ButtonLink>}
        />
      ) : null}

      {ready ? (
        mode === "solo" ? (
          <AudioReflexGame deckId={deck.id} deckTitle={deck.title} />
        ) : mode === "multiplayer" ? (
          <AudioReflexMultiplayer
            deckId={deck.id}
            deckTitle={deck.title}
            onBackToSolo={onChangeMode}
          />
        ) : (
          <SpaceStrikerMultiplayer
            deckId={deck.id}
            deckTitle={deck.title}
            onBackToSolo={onChangeMode}
          />
        )
      ) : null}
    </>
  );
}

function BackLink({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-xs font-semibold text-muted transition-all hover:bg-surface-2 hover:text-ink shadow-sm"
    >
      <ArrowLeft aria-hidden size={15} />
      {label}
    </button>
  );
}
