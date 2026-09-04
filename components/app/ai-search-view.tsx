"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { MagnifyingGlass } from "@phosphor-icons/react/MagnifyingGlass";
import { MagicWand } from "@phosphor-icons/react/MagicWand";

import { Container } from "@/components/ui/container";
import { Field, TextInput } from "@/components/ui/field";
import { EmptyState, ErrorState, RowSkeleton } from "@/components/app/states";
import { aiSearch, aiVocabLookup } from "@/lib/api/ai";
import { useAsync } from "@/lib/use-async";
import type { VocabLookupResponse } from "@/lib/api/types";
import { cn } from "@/lib/cn";

export function AiSearchView() {
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [lookupResult, setLookupResult] = useState<VocabLookupResponse | null>(null);
  const [lookupPending, setLookupPending] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(input.trim()), 400);
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

  useEffect(() => {
    if (!query) {
      setLookupResult(null);
      return;
    }
    let active = true;
    setLookupPending(true);
    aiVocabLookup({ word: query })
      .then((res) => {
        if (active) setLookupResult(res);
      })
      .catch(() => {
        if (active) setLookupResult(null);
      })
      .finally(() => {
        if (active) setLookupPending(false);
      });
    return () => {
      active = false;
    };
  }, [query]);

  const found = search.data;

  return (
    <Container size="wide">
      <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
        Tra từ & Tìm kiếm AI
      </h1>
      <p className="mt-2 text-base text-muted">
        Tra cứu nghĩa tiếng Việt, phát âm IPA, ví dụ bằng AI và tìm kiếm thẻ trong kho của bạn.
      </p>

      <div className="mt-8 max-w-xl">
        <Field id="ai-search" label="Từ cần tra">
          <TextInput
            id="ai-search"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="e.g. resilient, donut, bank..."
            autoComplete="off"
          />
        </Field>
      </div>

      <div className="mt-8 flex flex-col gap-6">
        {!query ? (
          <EmptyState
            title="Nhập một từ để bắt đầu"
            body="Kết quả tra từ điển AI và thẻ bài sẽ tự động hiện khi bạn ngừng gõ."
          />
        ) : (
          <>
            {/* AI Vocab Lookup Result Card */}
            {lookupPending ? (
              <div className="rounded-card border border-line bg-surface p-5 shadow-xs animate-pulse">
                <div className="flex items-center gap-2 text-sm text-muted">
                  <MagicWand size={16} className="text-accent animate-spin" />
                  Đang tra từ điển AI Service...
                </div>
              </div>
            ) : lookupResult ? (
              <div className="flex flex-col gap-4 rounded-card border border-accent/30 bg-surface p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
                  <div className="flex items-center gap-2">
                    <MagicWand size={20} className="text-accent" />
                    <span className="font-semibold text-ink">Từ điển AI</span>
                    <span className={cn(
                      "rounded-full px-2.5 py-0.5 text-2xs font-bold uppercase border",
                      lookupResult.source === "YOUR_DECK" ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" :
                      lookupResult.source === "CACHE" ? "bg-blue-500/10 text-blue-600 border-blue-500/20" :
                      "bg-purple-500/10 text-purple-600 border-purple-500/20"
                    )}>
                      {lookupResult.source} {lookupResult.source !== "AI" ? "(0 Token)" : "(LLM)"}
                    </span>
                  </div>

                  {lookupResult.card?.already_in_deck ? (
                    <span className="rounded-full bg-amber-500/10 px-3 py-0.5 text-xs font-medium text-amber-600 border border-amber-500/20">
                      ✓ Đã có trong bộ thẻ (#{lookupResult.card.existing_card_id})
                    </span>
                  ) : null}
                </div>

                {!lookupResult.found && lookupResult.suggestion ? (
                  <div className="rounded-md bg-amber-500/10 p-3 text-sm text-amber-700">
                    Ý bạn có phải là từ <strong className="font-bold underline cursor-pointer" onClick={() => setInput(lookupResult.suggestion!)}>{lookupResult.suggestion}</strong>?
                  </div>
                ) : null}

                {lookupResult.card ? (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold text-ink">{lookupResult.card.word}</span>
                      {lookupResult.card.phonetic ? <span className="font-serif text-muted">{lookupResult.card.phonetic}</span> : null}
                      {lookupResult.card.part_of_speech ? (
                        <span className="rounded-md bg-surface-2 px-2 py-0.5 text-2xs font-semibold uppercase text-muted">
                          {lookupResult.card.part_of_speech}
                        </span>
                      ) : null}
                    </div>

                    <p className="text-base font-medium text-ink">
                      <strong className="text-muted">Nghĩa Việt:</strong> {lookupResult.card.meaning}
                    </p>

                    {lookupResult.card.definition_en ? (
                      <p className="text-xs text-muted">
                        <strong className="text-ink font-medium">Định nghĩa EN:</strong> {lookupResult.card.definition_en}
                      </p>
                    ) : null}

                    {lookupResult.card.example_sentence ? (
                      <div className="mt-1 rounded-md bg-surface-2 p-3 text-xs border border-line/60">
                        <p className="font-serif italic text-ink/90">&quot;{lookupResult.card.example_sentence}&quot;</p>
                        {lookupResult.card.example_meaning ? (
                          <p className="mt-1 text-muted">{lookupResult.card.example_meaning}</p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* Deck Card Matching Results */}
            <div>
              <h2 className="text-lg font-semibold text-ink mb-3">Thẻ trùng khớp trong thư viện:</h2>
              {search.status === "loading" ? (
                <RowSkeleton count={3} />
              ) : search.status === "error" ? (
                <ErrorState message={search.error} onRetry={search.reload} />
              ) : !found || found.results.length === 0 ? (
                <div className="rounded-card border border-dashed border-line p-4 text-center text-sm text-muted">
                  Không tìm thấy thẻ nào khớp từ khóa trong bộ thẻ thư viện.
                </div>
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
                    {found.results.length} kết quả trong {found.candidate_count} ứng viên.
                  </p>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </Container>
  );
}
