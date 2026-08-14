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

/** Shared by the dashboard, the deck list and the public catalogue. */
export function DeckCard({ deck, actions, footer }: DeckCardProps) {
  return (
    <article className="card-lift flex h-full flex-col gap-4 rounded-card border border-line bg-surface p-6">
      <div className="flex items-start justify-between gap-3">
        <Link
          href={`/decks/${deck.id}`}
          className="text-lg font-semibold tracking-tight hover:text-accent-text"
        >
          {deck.title}
        </Link>
        {actions}
      </div>

      {deck.description ? (
        <p className="line-clamp-2 text-sm leading-relaxed text-muted">
          {deck.description}
        </p>
      ) : null}

      <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted">
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
        <ul className="flex flex-wrap gap-1.5">
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

      {footer}
    </article>
  );
}
