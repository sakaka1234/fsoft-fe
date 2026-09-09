"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Brain } from "@phosphor-icons/react/Brain";
import { Play } from "@phosphor-icons/react/Play";
import { CheckCircle } from "@phosphor-icons/react/CheckCircle";
import { ClockCountdown } from "@phosphor-icons/react/ClockCountdown";
import { Lightning } from "@phosphor-icons/react/Lightning";

import { getFsrsStudyQueue } from "@/lib/api/fsrs";
import { FsrsStudyMode } from "@/components/app/fsrs-study-mode";
import { CardSkeleton, ErrorState } from "@/components/app/states";
import { useAsync } from "@/lib/use-async";

/**
 * The live server answers date-only ("2026-09-09") for LEARNING cards, while
 * the OpenAPI document says dateTime, so both shapes are parsed here. A bare
 * date means the card is due at the start of that local day.
 */
function parseReviewDate(value: string | undefined): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(trimmed);
  const iso = dateOnly ? `${trimmed}T00:00:00` : trimmed;
  const time = new Date(iso).getTime();
  return Number.isNaN(time) ? null : time;
}

/** Formats a millisecond gap as HH:MM:SS, clamped at zero. */
function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Re-renders once a second so countdown text stays live. */
function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function FsrsVocabularyReviewView() {
  const [isStudying, setIsStudying] = useState(false);
  const now = useNow(1000);

  const queueState = useAsync(
    useCallback((signal: AbortSignal) => getFsrsStudyQueue(undefined, 120, 30, signal), []),
    "fsrs-study-queue-all",
  );

  const cards = queueState.status === "success" && queueState.data
    ? queueState.data.map((item) => item.card)
    : [];

  // The cluster's next review moment rides on the first queue element.
  const nextReviewAt = useMemo(() => {
    const first =
      queueState.status === "success" && queueState.data
        ? queueState.data[0]
        : undefined;
    return parseReviewDate(first?.nextReviewDate);
  }, [queueState.status, queueState.data]);

  const due = nextReviewAt !== null && nextReviewAt <= now;
  const countdown = nextReviewAt !== null ? formatCountdown(nextReviewAt - now) : null;

  if (queueState.status === "loading") {
    return (
      <div className="mt-6">
        <CardSkeleton count={2} />
      </div>
    );
  }

  if (queueState.status === "error") {
    return (
      <div className="mt-6">
        <ErrorState message={queueState.error} onRetry={queueState.reload} />
      </div>
    );
  }

  // EMPTY STATE: Khi chưa có từ vựng nào đến hạn
  if (queueState.status === "success" && cards.length === 0) {
    return (
      <div className="mt-6 flex flex-col items-center justify-center rounded-3xl border border-line bg-surface p-10 text-center shadow-md">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-500/15 text-emerald-500 shadow-inner mb-4">
          <CheckCircle size={48} weight="fill" />
        </div>
        <h3 className="text-2xl font-extrabold text-ink">Hiện tại chưa có từ vựng nào để ôn!</h3>
        <p className="mt-2 text-sm text-muted max-w-md leading-relaxed">
          Bạn đã hoàn thành xuất sắc tất cả từ vựng trong lượt FSRS này. Hãy quay lại sau khi tới mốc thời gian tiếp theo hoặc bổ sung thêm từ vựng mới!
        </p>
      </div>
    );
  }

  // ACTIVE STUDY SESSION
  if (isStudying) {
    return (
      <div className="mt-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              setIsStudying(false);
              queueState.reload();
            }}
            className="text-xs font-semibold text-muted hover:text-ink transition-colors cursor-pointer"
          >
            ← Quay lại màn hình tổng quan
          </button>
        </div>

        <FsrsStudyMode
          cards={cards}
          onFinished={() => {
            setIsStudying(false);
            queueState.reload();
          }}
        />
      </div>
    );
  }

  // HERO DASHBOARD OVERVIEW: Màn hình Tổng quan Cụm Ôn Tập FSRS
  return (
    <div className="mt-6 flex flex-col gap-6">
      <div className="relative overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-surface via-surface to-accent/5 p-8 shadow-xl">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-5">
            <div className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl bg-gradient-to-tr from-accent/20 to-indigo-500/20 text-accent border border-accent/20 shadow-lg">
              <Brain size={44} weight="fill" className="text-accent drop-shadow-md" />
            </div>

            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-accent border border-accent/20 mb-2">
                <Lightning size={14} weight="fill" /> Thuật Toán FSRS v21
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-ink">
                Ôn Tập Từ Vựng FSRS
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-muted max-w-lg leading-relaxed">
                Tự động gom cụm từ vựng đến hạn từ tất cả các bộ bài cá nhân của bạn để tối ưu hóa khả năng ghi nhớ dài hạn.
              </p>
            </div>
          </div>

          <div className="w-full md:w-auto flex flex-col items-center md:items-end gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setIsStudying(true)}
              className="w-full md:w-auto inline-flex items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-accent to-accent-hover px-8 py-4 text-base font-extrabold text-accent-fg shadow-xl hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
            >
              <Play size={20} weight="fill" />
              Bắt Đầu Ôn Tập ({cards.length} Từ)
            </button>
            <span className="text-[0.75rem] font-medium text-muted">
              Nhấn nút để bắt đầu lượt lật thẻ
            </span>
          </div>
        </div>

        {/* Real-time countdown: when the cluster comes due, in place of the old
            three stat boxes. Due state takes the danger tint so it reads as an
            action prompt rather than passive info. */}
        <div className="mt-8 border-t border-line pt-6">
          <div
            className={
              due
                ? "flex items-center justify-center gap-3 rounded-2xl border border-danger/30 bg-danger/10 px-5 py-4"
                : "flex items-center justify-center gap-3 rounded-2xl border border-line bg-surface-2/60 px-5 py-4"
            }
            role="timer"
            aria-live="off"
          >
            <ClockCountdown
              size={22}
              weight={due ? "fill" : "regular"}
              className={due ? "text-danger" : "text-accent"}
            />
            <p
              className={
                due
                  ? "text-base font-extrabold text-danger"
                  : "text-base font-bold text-ink"
              }
            >
              {due
                ? "Đã đến hạn ôn tập ngay!"
                : `Lượt ôn tập tiếp theo sau: ${countdown ?? "--:--:--"}`}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
