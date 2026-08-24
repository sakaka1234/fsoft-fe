"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { MagnifyingGlass } from "@phosphor-icons/react/MagnifyingGlass";

import { Container } from "@/components/ui/container";
import { Field, TextInput } from "@/components/ui/field";
import { EmptyState, ErrorState, RowSkeleton } from "@/components/app/states";
import { aiSearch } from "@/lib/api/ai";
import { useAsync } from "@/lib/use-async";

/**
 * Card search across the library.
 *
 * Two limits worth knowing, both measured against the live endpoint rather
 * than inferred, and both visible to anyone using this screen:
 *
 * 1. It does not index cards you just made. Four cards created seconds before
 *    a search for their exact words returned nothing.
 * 2. It matches exactly, not by meaning, despite the name. "deadline" hit with
 *    match_type EXACT while "work schedule" hit nothing against a deck holding
 *    commute and colleague.
 *
 * The copy below says "từ điển" rather than "thẻ của bạn" because of the first
 * point: promising a search of your own cards would be a promise this endpoint
 * does not keep today.
 */
export function AiSearchView() {
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");

  // Typing should not fire a request per keystroke. The committed query is what
  // the key depends on, so useAsync aborts the previous request when it moves.
  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(input.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [input]);

  const search = useAsync(
    useCallback(
      (signal: AbortSignal) =>
        query ? aiSearch(query, signal) : Promise.resolve(null),
      [query],
    ),
    `ai-search:${query}`,
  );

  const found = search.data;

  return (
    <Container size="wide">
      <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
        Tra từ
      </h1>
      <p className="mt-2 text-base text-muted">
        Tìm từ trong kho thẻ và xem nó nằm ở bộ thẻ nào.
      </p>

      <div className="mt-8 max-w-xl">
        <Field id="ai-search" label="Từ cần tra">
          <TextInput
            id="ai-search"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="deadline"
            autoComplete="off"
          />
        </Field>
      </div>

      <div className="mt-8">
        {!query ? (
          <EmptyState
            title="Nhập một từ để bắt đầu"
            body="Kết quả hiện ngay khi bạn ngừng gõ."
          />
        ) : search.status === "loading" ? (
          <RowSkeleton count={3} />
        ) : search.status === "error" ? (
          <ErrorState message={search.error} onRetry={search.reload} />
        ) : !found || found.results.length === 0 ? (
          <EmptyState
            title="Không tìm thấy từ nào"
            body="Tra cứu đang khớp theo đúng mặt chữ, nên thử gõ chính xác từ tiếng Anh."
          />
        ) : (
          <>
            <ul className="grid gap-3">
              {found.results.map((item) => (
                <li key={item.card_id}>
                  <Link
                    href={`/decks/${item.deck_id}`}
                    className="card-lift flex flex-wrap items-center justify-between gap-4 rounded-card border border-line bg-surface p-5"
                  >
                    <div className="min-w-0">
                      <p className="text-xl font-semibold tracking-tight">
                        {item.word}
                      </p>
                      <p className="mt-1 text-base text-muted">
                        {item.meaning}
                      </p>
                      <p className="mt-2 flex items-center gap-1.5 text-sm text-muted">
                        <MagnifyingGlass aria-hidden size={14} />
                        {item.deck_title}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full border border-line px-3 py-1 text-sm text-muted">
                      {item.match_type} · {item.score.toFixed(2)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>

            <p className="mt-5 text-sm text-muted">
              {found.results.length} kết quả trong {found.candidate_count} ứng
              viên, mất {found.latency_ms}ms.
            </p>
          </>
        )}
      </div>
    </Container>
  );
}
