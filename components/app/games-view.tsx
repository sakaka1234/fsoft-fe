"use client";

import { useCallback, useMemo, useState } from "react";

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
import { Users } from "@phosphor-icons/react/Users";

/*
  Chơi game như một điểm đến riêng, không phải một tab nằm trong bộ thẻ.

  Trang bộ thẻ vẫn giữ nguyên tab Chơi game của nó: ở đó bộ thẻ đã biết rồi nên
  bấm một lần là vào trận. Trang này lo trường hợp ngược lại, khi người chơi
  chưa nghĩ ra sẽ chơi bộ nào, và bắt đầu bằng câu hỏi "chơi kiểu gì".

  Ba bước, suy ra từ state chứ không giữ thêm biến bước: chọn kiểu chơi ->
  chọn bộ thẻ -> vào trận. Bỏ chọn kiểu chơi thì bộ thẻ vẫn được giữ, nên đổi
  từ Space Striker sang Chơi một mình không bắt chọn lại bộ thẻ.

  Danh sách kiểu chơi ở đây cố ý trùng nội dung với GAME_MODES trong
  deck-detail-view.tsx. Hai màn khác nhau về luồng, gộp lại thành một component
  dùng chung chỉ để tiết kiệm mười dòng dữ liệu sẽ tạo ra một tham số
  "đang ở màn nào" xuyên suốt, đắt hơn là lợi.
*/

const GAME_MODES = [
  {
    key: "solo" as const,
    title: "Chơi một mình",
    body: "Luyện phản xạ nghe, cộng điểm combo và leo bảng xếp hạng.",
    Icon: GameController,
  },
  {
    key: "multiplayer" as const,
    title: "Thi đấu với bạn bè",
    body: "Tạo phòng sáu ký tự hoặc nhập mã để đấu trực tiếp.",
    Icon: Users,
  },
  {
    key: "space-striker" as const,
    title: "Space Striker",
    body: "Lái phi thuyền bắn từ vựng, ai bắn trúng trước thì ghi điểm.",
    Icon: Rocket,
  },
];

type GameMode = (typeof GAME_MODES)[number]["key"];

/** Lấy rộng tay một trang: bộ chọn lọc ngay tại client nên không cần phân trang. */
const DECK_PAGE_SIZE = 50;

export function GamesView() {
  const [mode, setMode] = useState<GameMode | null>(null);
  const [deck, setDeck] = useState<DeckResponse | null>(null);

  const chosenMode = GAME_MODES.find((m) => m.key === mode) ?? null;

  return (
    <Container className="flex flex-col gap-8 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">Chơi game</h1>
        <p className="max-w-prose text-muted">
          Chọn kiểu chơi rồi chọn bộ thẻ muốn luyện. Không cần mở từng bộ thẻ
          nữa.
        </p>
      </header>

      {mode === null ? (
        <ModePicker onPick={setMode} />
      ) : deck === null ? (
        <DeckPicker
          modeTitle={chosenMode?.title ?? ""}
          onBack={() => setMode(null)}
          onPick={setDeck}
        />
      ) : (
        <PlayArea
          mode={mode}
          deck={deck}
          onChangeMode={() => setMode(null)}
          onChangeDeck={() => setDeck(null)}
        />
      )}
    </Container>
  );
}

/* ------------------------------ bước 1: kiểu chơi ------------------------ */

function ModePicker({ onPick }: { onPick: (mode: GameMode) => void }) {
  return (
    <section className="mx-auto w-full max-w-lg">
      <h2 className="text-xl font-semibold tracking-tight">Chọn cách chơi</h2>
      <p className="mt-2 text-base text-muted">
        Cùng một bộ thẻ, nghe rồi chọn nghĩa thật nhanh.
      </p>

      <ul className="mt-6 divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
        {GAME_MODES.map(({ key, title, body, Icon }) => (
          <li key={key}>
            <button
              type="button"
              onClick={() => onPick(key)}
              className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-surface-2"
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-field bg-accent-soft text-accent-text">
                <Icon aria-hidden size={22} weight="fill" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{title}</span>
                <span className="mt-0.5 block text-sm text-muted">{body}</span>
              </span>
              <CaretRight aria-hidden size={16} className="shrink-0 text-muted" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ------------------------------ bước 2: bộ thẻ --------------------------- */

function DeckPicker({
  modeTitle,
  onBack,
  onPick,
}: {
  modeTitle: string;
  onBack: () => void;
  onPick: (deck: DeckResponse) => void;
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

  /* Lọc tại client vì cả trang đã nằm sẵn trong bộ nhớ; gọi lại API cho mỗi
     ký tự gõ chỉ để lọc năm mươi dòng là phí. */
  const filtered = useMemo(() => {
    if (!rows) return null;
    const needle = keyword.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((deck) => deck.title.toLowerCase().includes(needle));
  }, [rows, keyword]);

  return (
    <section className="mx-auto w-full max-w-lg">
      <BackLink onClick={onBack} label="Đổi cách chơi" />

      <h2 className="mt-4 text-xl font-semibold tracking-tight">
        Chọn bộ thẻ để chơi
      </h2>
      <p className="mt-2 text-base text-muted">
        {modeTitle} cần một bộ thẻ. Chọn bộ bạn muốn luyện.
      </p>

      {rows && rows.length > 0 ? (
        <div className="mt-5">
          <label htmlFor="games-deck-search" className="sr-only">
            Tìm bộ thẻ
          </label>
          <TextInput
            id="games-deck-search"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="Tìm theo tên bộ thẻ"
          />
        </div>
      ) : null}

      {decks.status === "loading" ? (
        <div className="mt-5">
          <RowSkeleton count={4} />
        </div>
      ) : null}

      {decks.status === "error" ? (
        <div className="mt-5">
          <ErrorState message={decks.error} onRetry={decks.reload} />
        </div>
      ) : null}

      {filtered ? (
        filtered.length === 0 ? (
          <div className="mt-5">
            {rows && rows.length > 0 ? (
              <EmptyState
                title="Không có bộ thẻ nào khớp"
                body="Thử một từ khoá khác."
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
          <ul className="mt-5 divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
            {filtered.map((deck) => (
              <li key={deck.id}>
                <button
                  type="button"
                  onClick={() => onPick(deck)}
                  className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-surface-2"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">
                      {deck.title}
                    </span>
                    <span className="mt-0.5 block text-sm text-muted">
                      {/* totalCards không được backfill: bộ thẻ cũ báo 0 dù
                          vẫn có thẻ. Ẩn số 0 đi thay vì để nó bảo người chơi
                          rằng bộ này rỗng. */}
                      {deck.totalCards > 0 ? `${deck.totalCards} thẻ · ` : ""}
                      {deck.sourceLanguage} → {deck.targetLanguage}
                    </span>
                  </span>
                  <CaretRight
                    aria-hidden
                    size={16}
                    className="shrink-0 text-muted"
                  />
                </button>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </section>
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
  deck: DeckResponse;
  onChangeMode: () => void;
  onChangeDeck: () => void;
}) {
  /* Trang bộ thẻ chỉ mở đường vào game khi bộ thẻ thật sự có thẻ
     (deck-detail-view.tsx:498). Bước chọn bộ thẻ ở trên không biết điều đó vì
     totalCards không đáng tin, nên chốt chặn nằm ở đây — nếu không, chọn phải
     một bộ rỗng là rơi thẳng vào game rồi vỡ khi server không sinh nổi câu hỏi.

     Dùng ĐÚNG lời gọi và ĐÚNG cache key mà trang bộ thẻ đang dùng. Cùng key mà
     khác tham số thì cache chung trong lib/use-async.ts bị ghi đè: gọi rẻ hơn
     bằng (0, 1) sẽ khiến /decks/{id} mở ngay sau đó chỉ hiện một thẻ. */
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
    <section>
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <BackLink onClick={onChangeMode} label="Đổi cách chơi" />
        <button
          type="button"
          onClick={onChangeDeck}
          className="inline-flex min-h-10 items-center rounded-full px-3 text-sm font-medium text-muted transition-colors hover:bg-surface-2 hover:text-ink"
        >
          Đổi bộ thẻ:{" "}
          <span className="ml-1 font-semibold text-ink">{deck.title}</span>
        </button>
      </div>

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
    </section>
  );
}

function BackLink({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-muted transition-colors hover:bg-surface-2 hover:text-ink"
    >
      <ArrowLeft aria-hidden size={15} />
      {label}
    </button>
  );
}
