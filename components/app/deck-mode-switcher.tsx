"use client";

import type { Icon } from "@phosphor-icons/react";

import { cn } from "@/lib/cn";

export type DeckViewMode =
  | "list"
  | "single"
  | "study"
  | "quiz"
  | "ask"
  | "game";

export type DeckMode = {
  key: DeckViewMode;
  label: string;
  Icon: Icon;
  /** Filled accent instead of the plain active pill. For the game only. */
  accent?: boolean;
};

type DeckModeSwitcherProps = {
  modes: DeckMode[];
  active: DeckViewMode;
  onChange: (mode: DeckViewMode) => void;
};

/**
 * The deck's view switcher, one array driving one row.
 *
 * It used to be two hand written copies, one absolutely centred in the header
 * for md and up and one stacked underneath for mobile, three buttons each.
 * Six modes would have made that twelve buttons to keep in step, and the
 * centred pill would have grown wide enough to run into the action buttons
 * sharing that row. So it moved to a row of its own at every width.
 *
 * Labels hide below lg and the icons carry an aria-label there, which keeps
 * six targets comfortably tappable instead of splitting a phone's width six
 * ways. The row scrolls sideways if it still runs out of room, and
 * scrollbar-none keeps that from showing a bar on desktop.
 */
export function DeckModeSwitcher({
  modes,
  active,
  onChange,
}: DeckModeSwitcherProps) {
  return (
    <div className="mt-4 flex justify-center overflow-x-auto">
      <div
        role="tablist"
        aria-label="Chế độ xem bộ thẻ"
        className="flex h-auto shrink-0 items-center gap-1 rounded-full border border-line bg-surface-2 p-1 text-sm font-medium shadow-sm lg:h-10"
      >
        {modes.map(({ key, label, Icon: ModeIcon, accent }) => {
          const isActive = active === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-label={label}
              onClick={() => onChange(key)}
              className={cn(
                "flex h-10 shrink-0 items-center gap-1.5 rounded-full px-3.5 transition-colors lg:h-8",
                isActive
                  ? accent
                    ? "bg-accent text-accent-fg shadow-sm"
                    : "bg-surface text-ink shadow-sm"
                  : "text-muted hover:text-ink",
              )}
            >
              <ModeIcon size={16} />
              <span className="hidden lg:inline">{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
