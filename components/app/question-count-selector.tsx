"use client";

import { Clock } from "@phosphor-icons/react/Clock";
import { cn } from "@/lib/cn";

interface QuestionCountSelectorProps {
  value: number;
  onChange: (count: number) => void;
  totalCards?: number | null;
  label?: string;
  isHost?: boolean;
  configuredCount?: number;
  presets?: number[];
  className?: string;
}

export function QuestionCountSelector({
  value,
  onChange,
  totalCards = 0,
  label,
  isHost = true,
  configuredCount,
  presets = [5, 10, 15, 20],
  className,
}: QuestionCountSelectorProps) {
  const maxLimit = totalCards && totalCards > 0 ? totalCards : 999;
  const displayTotal = totalCards !== null && totalCards !== undefined ? totalCards : "...";
  const fieldLabel = label ?? (isHost ? "Cấu hình số lượng câu hỏi:" : "Số lượng câu hỏi trận đấu:");

  if (!isHost) {
    return (
      <div className={cn("w-full p-4 rounded-card border border-line bg-surface-2/60 text-left space-y-2 shadow-2xs", className)}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-bold text-ink flex items-center gap-1.5">
            <Clock size={16} className="text-accent" />
            {fieldLabel}
          </span>
          <span className="text-xs font-semibold text-accent bg-accent-soft px-2.5 py-0.5 rounded-full border border-accent/20">
            Tổng từ vựng phòng: {displayTotal} thẻ
          </span>
        </div>
        <p className="text-xs text-muted font-medium pt-1">
          Chủ phòng đã thiết lập: <strong className="text-ink font-bold">{value ?? configuredCount} câu hỏi</strong>
        </p>
      </div>
    );
  }

  return (
    <div className={cn("w-full p-4 rounded-card border border-line bg-surface-2/60 text-left space-y-3 shadow-2xs", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-bold text-ink flex items-center gap-1.5">
          <Clock size={16} className="text-accent" />
          {fieldLabel}
        </span>
        <span className="text-xs font-semibold text-accent bg-accent-soft px-2.5 py-0.5 rounded-full border border-accent/20">
          Tổng từ vựng phòng: {displayTotal} thẻ
        </span>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
        <div className="flex-1">
          <label htmlFor="question-count-input" className="sr-only">Số lượng câu hỏi</label>
          <input
            id="question-count-input"
            type="number"
            min={1}
            max={maxLimit}
            value={value}
            onChange={(e) => {
              const val = parseInt(e.target.value) || 1;
              onChange(Math.max(1, Math.min(maxLimit, val)));
            }}
            className="w-full rounded-field border border-line bg-surface px-3.5 py-2 text-sm font-bold text-ink focus:border-accent focus:outline-none"
            placeholder="Nhập số câu hỏi..."
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {presets.map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => onChange(Math.min(maxLimit, num))}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-bold border transition-all cursor-pointer",
                value === num
                  ? "bg-accent text-accent-fg border-accent shadow-sm"
                  : "bg-surface text-muted border-line hover:text-ink"
              )}
            >
              {num} câu
            </button>
          ))}
          {totalCards && totalCards > 0 ? (
            <button
              type="button"
              onClick={() => onChange(totalCards)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-bold border transition-all cursor-pointer",
                value === totalCards
                  ? "bg-accent text-accent-fg border-accent shadow-sm"
                  : "bg-surface text-muted border-line hover:text-ink"
              )}
            >
              Tất cả ({totalCards})
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
