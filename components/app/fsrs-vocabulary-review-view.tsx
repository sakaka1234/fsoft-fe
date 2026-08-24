"use client";

import { useCallback, useState } from "react";
import { Brain } from "@phosphor-icons/react/Brain";
import { Play } from "@phosphor-icons/react/Play";
import { CheckCircle } from "@phosphor-icons/react/CheckCircle";
import { Clock } from "@phosphor-icons/react/Clock";
import { Lightning } from "@phosphor-icons/react/Lightning";
import { Cards } from "@phosphor-icons/react/Cards";

import { getFsrsStudyQueue } from "@/lib/api/fsrs";
import { FsrsStudyMode } from "@/components/app/fsrs-study-mode";
import { CardSkeleton, ErrorState } from "@/components/app/states";
import { useAsync } from "@/lib/use-async";

export function FsrsVocabularyReviewView() {
  const [isStudying, setIsStudying] = useState(false);

  const queueState = useAsync(
    useCallback((signal: AbortSignal) => getFsrsStudyQueue(undefined, 120, 30, signal), []),
    "fsrs-study-queue-all",
  );

  const cards = queueState.status === "success" && queueState.data
    ? queueState.data.map((item) => item.card)
    : [];

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
            onClick={() => setIsStudying(false)}
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

        {/* Stats Grid Bar */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 border-t border-line">
          <div className="flex items-center gap-3.5 p-4 rounded-2xl border border-line bg-surface-2/60">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 text-accent">
              <Cards size={22} weight="fill" />
            </div>
            <div>
              <p className="text-[0.7rem] font-extrabold uppercase tracking-wider text-muted">Từ vựng cần ôn</p>
              <p className="text-lg font-black text-ink font-mono">{cards.length} từ</p>
            </div>
          </div>

          <div className="flex items-center gap-3.5 p-4 rounded-2xl border border-line bg-surface-2/60">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-500">
              <Clock size={22} weight="fill" />
            </div>
            <div>
              <p className="text-[0.7rem] font-extrabold uppercase tracking-wider text-muted">Cụm thời gian</p>
              <p className="text-lg font-black text-ink font-mono">30 Phút Gần Nhất</p>
            </div>
          </div>

          <div className="flex items-center gap-3.5 p-4 rounded-2xl border border-line bg-surface-2/60">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-500">
              <Lightning size={22} weight="fill" />
            </div>
            <div>
              <p className="text-[0.7rem] font-extrabold uppercase tracking-wider text-muted">Mức độ ưu tiên</p>
              <p className="text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono">Đến Hạn Ôn Tập</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
