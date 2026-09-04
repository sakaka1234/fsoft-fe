"use client";

import { useEffect, useState } from "react";
import { Warning } from "@phosphor-icons/react/Warning";

import { Button } from "@/components/ui/button";

type ConfirmMode = "confirm" | "prompt";

type ConfirmDialogProps = {
  mode: ConfirmMode;
  title: string;
  body: string;
  /** Confirm-button label. */
  confirmLabel?: string;
  /** Destructive intent colors the confirm button with the danger token. */
  destructive?: boolean;
  /** Prompt mode: initial value of the text input. */
  defaultValue?: string;
  /** Prompt mode: textarea instead of single-line input. */
  multiline?: boolean;
  placeholder?: string;
  /** Resolves (true, input) when confirmed, (false, current input) when dismissed. */
  onResolve: (accepted: boolean, value: string) => void;
};

/**
 * In-app replacement for window.confirm and window.prompt. A dialog over the
 * page, Enter confirms, Escape dismisses, focus lands on the confirm button so
 * keyboard users are one press from acting.
 */
export function ConfirmDialog({
  mode,
  title,
  body,
  confirmLabel = "Xác nhận",
  destructive = false,
  defaultValue = "",
  multiline = false,
  placeholder,
  onResolve,
}: ConfirmDialogProps) {
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onResolve(false, value);
    }
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onResolve, value]);

  function onBackdrop(event: React.MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) onResolve(false, value);
  }

  function confirm() {
    onResolve(true, value);
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onBackdrop}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="w-full max-w-md rounded-card border border-line bg-paper p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-start gap-3">
          {destructive ? (
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-danger/10">
              <Warning size={20} weight="fill" className="text-danger" />
            </span>
          ) : null}
          <div className="flex flex-col gap-1.5 min-w-0">
            <h2 className="text-lg font-semibold tracking-tight text-ink">{title}</h2>
            <p className="text-sm leading-relaxed text-muted">{body}</p>
          </div>
        </div>

        {mode === "prompt" ? (
          <div className="mt-4 flex flex-col gap-2">
            <label htmlFor="confirm-dialog-input" className="text-sm font-medium text-ink">
              Lý do
            </label>
            {multiline ? (
              <textarea
                id="confirm-dialog-input"
                rows={3}
                value={value}
                placeholder={placeholder}
                onChange={(e) => setValue(e.target.value)}
                autoFocus
                className="w-full rounded-field border border-line bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
              />
            ) : (
              <input
                id="confirm-dialog-input"
                value={value}
                placeholder={placeholder}
                onChange={(e) => setValue(e.target.value)}
                autoFocus
                className="h-10 w-full rounded-field border border-line bg-surface px-3.5 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
              />
            )}
          </div>
        ) : null}

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => onResolve(false, value)}>
            Huỷ
          </Button>
          <Button
            onClick={confirm}
            autoFocus={mode === "confirm"}
            className={destructive ? "bg-danger text-white hover:bg-danger/85" : undefined}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}