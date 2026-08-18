import { useState } from "react";
import Link from "next/link";
// CSR entry: every caller of this card is a client component.
import { Cards } from "@phosphor-icons/react/Cards";

import type { DeckResponse } from "@/lib/api/types";

export const VISIBILITY_LABEL: Record<string, string> = {
  PUBLIC: "Public",
  PRIVATE: "Private",
  SHARED: "Shared",
};

type DeckCardProps = {
  deck: DeckResponse;
  /** Row of buttons in the top right, e.g. delete on your own decks. */
  actions?: React.ReactNode;
  /** Row under the meta line, e.g. fork on someone else's deck. */
  footer?: React.ReactNode;
};

function DeckCardCover({ src, alt }: { src: string; alt: string }) {
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
    <div className="-mx-6 -mt-6 h-44 w-[calc(100%+3rem)] overflow-hidden border-b border-line bg-surface-2">
      <img
        src={cleanSrc}
        alt={alt}
        onError={() => setHasError(true)}
        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
      />
    </div>
  );
}

/** Shared by the dashboard, the deck list and the public catalogue. */
export function DeckCard({ deck, actions, footer }: DeckCardProps) {
  return (
    <article className="card-lift group relative flex h-full flex-col gap-4 overflow-hidden rounded-card border border-line bg-surface p-6 cursor-pointer">
      {/* Full card clickable overlay link */}
      <Link
        href={`/decks/${deck.id}`}
        className="absolute inset-0 z-0"
        aria-label={`Mở bộ thẻ ${deck.title}`}
      />

      {deck.coverImageUrl ? (
        <DeckCardCover src={deck.coverImageUrl} alt={deck.title} />
      ) : null}

      <div className="relative z-10 flex items-start justify-between gap-3 pointer-events-none">
        <h3 className="text-lg font-semibold tracking-tight group-hover:text-accent-text transition-colors">
          {deck.title}
        </h3>
        {actions ? (
          <div
            className="pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {actions}
          </div>
        ) : null}
      </div>

      {deck.description ? (
        <p className="line-clamp-2 text-sm leading-relaxed text-muted relative z-10 pointer-events-none">
          {deck.description}
        </p>
      ) : null}

      <div className="mt-auto relative z-10 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted pointer-events-none">
        <span className="font-mono uppercase">
          {deck.sourceLanguage} to {deck.targetLanguage}
        </span>
        <span className="rounded-full border border-line px-2.5 py-0.5 text-xs">
          {VISIBILITY_LABEL[deck.visibility] ?? deck.visibility}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Cards aria-hidden size={15} />
          <span className="font-mono tabular-nums">{deck.totalCards}</span>
        </span>
      </div>

      {deck.tags.length > 0 ? (
        <ul className="relative z-10 flex flex-wrap gap-1.5 pointer-events-none">
          {deck.tags.map((tag) => (
            <li
              key={tag.id}
              className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs text-accent-text"
            >
              {tag.name}
            </li>
          ))}
        </ul>
      ) : null}

      {footer ? (
        <div
          className="relative z-10 pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {footer}
        </div>
      ) : null}
    </article>
  );
}
