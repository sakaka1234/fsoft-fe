"use client";

import { useCallback, useState } from "react";
import { ArrowCounterClockwise } from "@phosphor-icons/react/ArrowCounterClockwise";

import { Button } from "@/components/ui/button";
import { SingleCardView } from "@/components/app/single-card-view";
import {
  EmptyState,
  ErrorState,
  SingleCardSkeleton,
} from "@/components/app/states";
import { ApiError } from "@/lib/api/client";
import { getStudyQueue, resetDeckSrs, reviewCard } from "@/lib/api/srs";
import type { CardResponse, SrsRating } from "@/lib/api/types";
import { useAsync } from "@/lib/use-async";
import { cn } from "@/lib/cn";

/**
 * Grades, in SM-2 order. Verified against the API rather than guessed: rating
 * 1 resets repetitions and reschedules the card for the same day, 2, 3 and 4
 * all move it to the next day with progressively less damage to easiness.
 */
const GRADES: { rating: SrsRating; label: string; hint: string }[] = [
  { rating: 1, label: "Again", hint: "Hôm nay gặp lại" },
  { rating: 2, label: "Hard", hint: "Khó" },
  { rating: 3, label: "Good", hint: "Nhớ được" },
  { rating: 4, label: "Easy", hint: "Dễ" },
];

type SrsStudyViewProps = {
  deckId: number;
};

/**
 * A spaced repetition session over one deck.
 *
 * The card face is SingleCardView untouched: it already flips, handles the
 * keyboard and plays audio, and rebuilding any of that here would be two
 * implementations of the same card drifting apart. This owns only the queue,
 * the grade buttons and the progress.
 */
export function SrsStudyView({ deckId }: SrsStudyViewProps) {
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingReset, setConfirmingReset] = useState(false);

  const queue = useAsync(
    useCallback(
      (signal: AbortSignal) => getStudyQueue(deckId, 20, signal),
      [deckId],
    ),
    `srs-queue-${deckId}`,
  );

  async function run(action: () => Promise<unknown>) {
    setError(null);
    setBusy(true);
    try {
      await action();
      return true;
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Không chấm được thẻ này. Thử lại nhé.",
      );
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function onGrade(rating: SrsRating) {
    const entry = queue.data?.[index];
    if (!entry) return;

    const ok = await run(() => reviewCard(entry.card.id, rating));
    /* Advance only on success, so a failed grade leaves the reader on the card
       they still have to answer rather than silently skipping it. */
    if (ok) setIndex((value) => value + 1);
  }

  async function onReset() {
    const ok = await run(() => resetDeckSrs(deckId));
    if (ok) {
      setConfirmingReset(false);
      setIndex(0);
      queue.reload();
    }
  }

  if (queue.status === "loading") return <SingleCardSkeleton />;
  if (queue.status === "error") {
    return <ErrorState message={queue.error} onRetry={queue.reload} />;
  }

  const entries = queue.data;
  const done = index >= entries.length;

  if (entries.length === 0) {
    return (
      <EmptyState
        title="Chưa có thẻ nào tới hạn"
        body="Bộ thẻ này đang trống hoặc bạn đã ôn hết phần của hôm nay."
      />
    );
  }

  if (done) {
    return (
      <div className="mx-auto max-w-xl text-center">
        <EmptyState
          title="Xong phần hôm nay"
          body={`Bạn vừa ôn ${entries.length} thẻ. Quay lại khi tới lịch kế tiếp.`}
        />
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button
            variant="secondary"
            onClick={() => {
              setIndex(0);
              queue.reload();
            }}
          >
            Tải lại hàng đợi
          </Button>
        </div>
      </div>
    );
  }

  const entry = entries[index];
  /* SingleCardView takes a list and an index. Handing it the one card keeps
     its own next and previous controls from walking out of the session. */
  const cards: CardResponse[] = [entry.card];

  return (
    <div>
      <div className="mx-auto flex max-w-xl flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          Thẻ {index + 1} / {entries.length}
          <span className="ml-2 rounded-full border border-line px-2 py-0.5">
            {entry.status}
          </span>
        </p>
        <Button
          variant="secondary"
          onClick={() => setConfirmingReset(true)}
          disabled={busy}
        >
          <ArrowCounterClockwise aria-hidden size={15} />
          Đặt lại tiến độ
        </Button>
      </div>

      <div
        aria-hidden
        className="mx-auto mt-3 h-1 max-w-xl overflow-hidden rounded-full bg-surface-2"
      >
        <div
          className="h-full bg-accent transition-[width] duration-300"
          style={{ width: `${(index / entries.length) * 100}%` }}
        />
      </div>

      {confirmingReset ? (
        <div className="mx-auto mt-4 max-w-xl rounded-card border border-line bg-surface p-4">
          <p className="text-base">
            Đặt lại toàn bộ tiến độ ghi nhớ của bộ thẻ này? Mọi thẻ quay về NEW
            và lịch ôn hiện tại sẽ mất.
          </p>
          <div className="mt-4 flex gap-3">
            <Button onClick={onReset} disabled={busy}>
              {busy ? "Đang đặt lại..." : "Đặt lại"}
            </Button>
            <Button
              variant="secondary"
              onClick={() => setConfirmingReset(false)}
              disabled={busy}
            >
              Huỷ
            </Button>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="mx-auto mt-4 max-w-xl">
          <ErrorState message={error} />
        </div>
      ) : null}

      <div className="mt-6">
        <SingleCardView
          key={entry.card.id}
          cards={cards}
          currentIndex={0}
          onIndexChange={() => {}}
          busy={busy}
        />
      </div>

      <div className="mx-auto mt-6 grid max-w-xl grid-cols-2 gap-3 sm:grid-cols-4">
        {GRADES.map(({ rating, label, hint }) => (
          <button
            key={rating}
            type="button"
            onClick={() => onGrade(rating)}
            disabled={busy}
            className={cn(
              "flex flex-col items-center gap-0.5 rounded-field border border-line bg-surface px-3 py-3",
              "transition-colors hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-60",
              rating === 1 && "border-danger/40",
            )}
          >
            <span className="font-semibold">{label}</span>
            <span className="text-sm text-muted">{hint}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
