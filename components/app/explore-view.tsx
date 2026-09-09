"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GitFork } from "@phosphor-icons/react/GitFork";
import { MagnifyingGlass } from "@phosphor-icons/react/MagnifyingGlass";

import { useSession } from "@/lib/auth/use-session";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Field, TextInput } from "@/components/ui/field";
import { SelectDropdown } from "@/components/ui/select-dropdown";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { pageRange } from "@/lib/page-range";
import { DeckCard } from "@/components/app/deck-card";
import { CardSkeleton, EmptyState, ErrorState } from "@/components/app/states";
import { ApiError } from "@/lib/api/client";
import { forkDeck, listPublicDecks } from "@/lib/api/decks";
import { listTags } from "@/lib/api/tags";
import type { DeckResponse } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { useAsync } from "@/lib/use-async";

const PAGE_SIZE = 12;

const LANGUAGES = [
  { code: "", label: "Any language" },
  { code: "en", label: "English" },
  { code: "vi", label: "Vietnamese" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
  { code: "zh", label: "Chinese" },
  { code: "fr", label: "French" },
] as const;

export function ExploreView() {
  const router = useRouter();
  const session = useSession();
  const [keywordInput, setKeywordInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [tagId, setTagId] = useState<number | undefined>();
  const [sourceLang, setSourceLang] = useState("");
  const [targetLang, setTargetLang] = useState("");
  const [page, setPage] = useState(1);
  const [forkingId, setForkingId] = useState<number | null>(null);
  const [forkError, setForkError] = useState<string | null>(null);

  // Typing should not fire a request per keystroke. The committed keyword is
  // what the query key depends on, so useAsync aborts the previous request
  // whenever it changes.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setKeyword(keywordInput.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [keywordInput]);

  const tags = useAsync(
    useCallback((signal: AbortSignal) => listTags(signal), []),
    "tags",
  );

  const decks = useAsync(
    useCallback(
      (signal: AbortSignal) =>
        listPublicDecks(
          { page, size: PAGE_SIZE, keyword, tagId, sourceLang, targetLang },
          signal,
        ),
      [page, keyword, tagId, sourceLang, targetLang],
    ),
    `public:${page}:${keyword}:${tagId ?? ""}:${sourceLang}:${targetLang}`,
  );

  function resetToFirstPage() {
    setPage(1);
  }

  async function onFork(deck: DeckResponse) {
    if (session?.user?.id && String(session.user.id) === String(deck.profileId)) {
      return;
    }
    setForkingId(deck.id);
    setForkError(null);
    try {
      const copy = await forkDeck(deck.id);
      router.push(`/decks/${copy.id}`);
    } catch (error) {
      setForkError(
        error instanceof ApiError
          ? error.message
          : "Could not copy that deck. Please try again.",
      );
      setForkingId(null);
    }
  }

  // Decks number pages from 1, so the last page is totalPages itself. `last`
  // from the payload agrees, but this stays readable next to the card list,
  // which counts from 0.
  const hasResults = decks.status === "success" && decks.data.content.length > 0;
  const totalPages = decks.status === "success" ? decks.data.totalPages : 0;

  return (
    <Container size="wide">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
          Public decks
        </h1>
        <p className="mt-2 max-w-[58ch] text-base text-muted">
          Decks other learners have published. Copy one into your own list and
          it becomes yours to edit.
        </p>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-4">
        <Field id="explore-keyword" label="Search" className="md:col-span-2">
          <div className="relative">
            <MagnifyingGlass
              aria-hidden
              size={17}
              className="absolute top-1/2 left-3.5 -translate-y-1/2 text-muted"
            />
            <TextInput
              id="explore-keyword"
              type="search"
              value={keywordInput}
              onChange={(event) => setKeywordInput(event.target.value)}
              placeholder="Travel, business, exam"
              className="pl-10"
            />
          </div>
        </Field>

        <Field id="explore-source" label="From">
          <SelectDropdown
            id="explore-source"
            value={sourceLang}
            options={LANGUAGES.map((language) => ({
              value: language.code,
              label: language.label,
            }))}
            onValueChange={(v) => {
              setSourceLang(v);
              resetToFirstPage();
            }}
          />
        </Field>

        <Field id="explore-target" label="Into">
          <SelectDropdown
            id="explore-target"
            value={targetLang}
            options={LANGUAGES.map((language) => ({
              value: language.code,
              label: language.label,
            }))}
            onValueChange={(v) => {
              setTargetLang(v);
              resetToFirstPage();
            }}
          />
        </Field>
      </div>

      {tags.status === "success" && tags.data.length > 0 ? (
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setTagId(undefined);
              resetToFirstPage();
            }}
            aria-pressed={tagId === undefined}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
              tagId === undefined
                ? "border-accent bg-accent text-accent-fg"
                : "border-line text-muted hover:text-ink",
            )}
          >
            All tags
          </button>
          {tags.data.map((tag) => {
            const selected = tagId === tag.id;
            return (
              <button
                key={tag.id}
                type="button"
                onClick={() => {
                  setTagId(selected ? undefined : tag.id);
                  resetToFirstPage();
                }}
                aria-pressed={selected}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                  selected
                    ? "border-accent bg-accent text-accent-fg"
                    : "border-line text-muted hover:text-ink",
                )}
              >
                {tag.name}
              </button>
            );
          })}
        </div>
      ) : null}

      {forkError ? (
        <div className="mt-6">
          <ErrorState message={forkError} />
        </div>
      ) : null}

      <div className="mt-10">
        {decks.status === "loading" ? <CardSkeleton count={6} /> : null}

        {decks.status === "error" ? (
          <ErrorState message={decks.error} onRetry={decks.reload} />
        ) : null}

        {decks.status === "success" && !hasResults ? (
          <EmptyState
            title="Nothing matches that"
            body={
              keyword || tagId || sourceLang || targetLang
                ? "Try a different word, or clear the filters to see everything that has been published."
                : "No public decks yet. Publish one of yours by setting its visibility to Public."
            }
          />
        ) : null}

        {hasResults ? (
          <>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {decks.data.content.map((deck) => {
                const isMyDeck = Boolean(
                  session?.user?.id &&
                  String(session.user.id) === String(deck.profileId),
                );

                return (
                  <li key={deck.id}>
                    <DeckCard
                      deck={deck}
                      footer={
                        <Button
                          variant="secondary"
                          onClick={() => onFork(deck)}
                          disabled={isMyDeck || forkingId === deck.id}
                          className="w-full"
                        >
                          <GitFork aria-hidden size={15} />
                          {isMyDeck
                            ? "Bộ thẻ của bạn"
                            : forkingId === deck.id
                              ? "Copying"
                              : "Copy to my decks"}
                        </Button>
                      }
                    />
                  </li>
                );
              })}
            </ul>

            {totalPages > 1 ? (
              <Pagination className="mt-10">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      aria-disabled={page <= 1}
                      onClick={(e) => {
                        e.preventDefault();
                        if (page > 1) setPage((value) => Math.max(1, value - 1));
                      }}
                    />
                  </PaginationItem>

                  {pageRange(page, totalPages).map((value) =>
                    value === "ellipsis" ? (
                      <PaginationItem key={`e-${value}`}>
                        <PaginationEllipsis />
                      </PaginationItem>
                    ) : (
                      <PaginationItem key={value}>
                        <PaginationLink
                          href="#"
                          isActive={value === page}
                          onClick={(e) => {
                            e.preventDefault();
                            setPage(value);
                          }}
                        >
                          {value}
                        </PaginationLink>
                      </PaginationItem>
                    ),
                  )}

                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      aria-disabled={page >= totalPages}
                      onClick={(e) => {
                        e.preventDefault();
                        if (page < totalPages) setPage((value) => value + 1);
                      }}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            ) : null}
          </>
        ) : null}
      </div>
    </Container>
  );
}
