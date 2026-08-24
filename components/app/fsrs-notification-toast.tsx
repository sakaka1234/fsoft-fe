"use client";

import { Brain } from "@phosphor-icons/react/Brain";
import { X } from "@phosphor-icons/react/X";
import { ArrowRight } from "@phosphor-icons/react/ArrowRight";

type FsrsNotificationToastProps = {
  count: number;
  isOpen: boolean;
  onClose: () => void;
  onStartReview: () => void;
};

export function FsrsNotificationToast({
  count,
  isOpen,
  onClose,
  onStartReview,
}: FsrsNotificationToastProps) {
  if (!isOpen || count <= 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 max-w-sm w-full animate-in slide-in-from-bottom-5 duration-300">
      <div className="flex flex-col gap-3 rounded-2xl border-2 border-accent/40 bg-surface p-4 shadow-2xl backdrop-blur-md">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-fg animate-pulse">
              <Brain size={22} weight="fill" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-ink">Đã Đến Giờ Ôn Từ Vựng!</h4>
              <p className="text-xs text-muted mt-0.5">
                Bạn có <strong className="text-accent-text font-bold">{count} từ vựng</strong> trong cụm FSRS đến hạn.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-muted hover:bg-surface-2 hover:text-ink transition-colors"
            title="Đóng thông báo"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex items-center justify-end gap-2 pt-1 border-t border-line">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-full text-xs font-semibold text-muted hover:text-ink transition-colors"
          >
            Bỏ qua
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              onStartReview();
            }}
            className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-1.5 text-xs font-bold text-accent-fg hover:opacity-90 transition-opacity shadow-sm"
          >
            Ôn Ngay <ArrowRight size={14} weight="bold" />
          </button>
        </div>
      </div>
    </div>
  );
}
