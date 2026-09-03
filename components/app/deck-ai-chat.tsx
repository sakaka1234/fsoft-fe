"use client";

import { useRef, useState } from "react";
import { PaperPlaneTilt } from "@phosphor-icons/react/PaperPlaneTilt";

import { Button } from "@/components/ui/button";
import { TextInput } from "@/components/ui/field";
import { ErrorState } from "@/components/app/states";
import { ApiError } from "@/lib/api/client";
import { aiChat } from "@/lib/api/ai";
import type { AiCitation, ChatMessage } from "@/lib/api/types";
import { cn } from "@/lib/cn";

type Turn = {
  role: "user" | "assistant";
  content: string;
  citations?: AiCitation[];
  /** What the retriever actually searched for, kept for the details block. */
  rewrittenQuery?: string;
  answerSource?: string;
};

type DeckAiChatProps = {
  deckId: number;
  /** Jumps the deck view to a cited card. */
  onOpenCard?: (cardId: number) => void;
};

const STARTERS = [
  "Giải thích từ khó nhất trong bộ thẻ này",
  "Đặt câu ví dụ cho ba từ bất kỳ",
  "Những từ nào dễ nhầm lẫn với nhau?",
];

function FormattedMarkdown({ content }: { content: string }) {
  if (!content) return null;

  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let elementCounter = 0;
  let currentList: { type: "ul" | "ol"; items: React.ReactNode[] } | null = null;

  function flushList() {
    if (currentList) {
      const listKey = `list-${++elementCounter}`;
      if (currentList.type === "ul") {
        elements.push(
          <ul key={listKey} className="my-2 list-disc space-y-1 pl-5">
            {currentList.items.map((item, idx) => (
              <li key={`item-${idx}`}>{item}</li>
            ))}
          </ul>
        );
      } else {
        elements.push(
          <ol key={listKey} className="my-2 list-decimal space-y-1 pl-5">
            {currentList.items.map((item, idx) => (
              <li key={`item-${idx}`}>{item}</li>
            ))}
          </ol>
        );
      }
      currentList = null;
    }
  }

  function parseInline(text: string): React.ReactNode[] {
    const parts: React.ReactNode[] = [];
    const regex = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g;
    let lastIdx = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIdx) {
        parts.push(text.substring(lastIdx, match.index));
      }
      const matchedStr = match[0];
      const inlineKey = `inline-${match.index}`;
      if (matchedStr.startsWith("**") && matchedStr.endsWith("**")) {
        parts.push(
          <strong key={inlineKey} className="font-semibold text-foreground">
            {matchedStr.slice(2, -2)}
          </strong>
        );
      } else if (matchedStr.startsWith("`") && matchedStr.endsWith("`")) {
        parts.push(
          <code key={inlineKey} className="rounded bg-surface px-1.5 py-0.5 font-mono text-xs text-brand">
            {matchedStr.slice(1, -1)}
          </code>
        );
      } else if (matchedStr.startsWith("*") && matchedStr.endsWith("*")) {
        parts.push(
          <em key={inlineKey} className="italic">
            {matchedStr.slice(1, -1)}
          </em>
        );
      }
      lastIdx = regex.lastIndex;
    }

    if (lastIdx < text.length) {
      parts.push(text.substring(lastIdx));
    }

    return parts;
  }

  lines.forEach((rawLine) => {
    const line = rawLine.trim();

    if (!line) {
      flushList();
      return;
    }

    const itemKey = `elem-${++elementCounter}`;

    if (line.startsWith("### ")) {
      flushList();
      elements.push(
        <h4 key={itemKey} className="mt-3 mb-1 font-semibold text-base text-foreground">
          {parseInline(line.slice(4))}
        </h4>
      );
      return;
    }
    if (line.startsWith("## ")) {
      flushList();
      elements.push(
        <h3 key={itemKey} className="mt-4 mb-2 font-bold text-lg text-foreground">
          {parseInline(line.slice(3))}
        </h3>
      );
      return;
    }
    if (line.startsWith("# ")) {
      flushList();
      elements.push(
        <h2 key={itemKey} className="mt-4 mb-2 font-bold text-xl text-foreground">
          {parseInline(line.slice(2))}
        </h2>
      );
      return;
    }

    const bulletMatch = line.match(/^[-*•]\s+(.+)/);
    if (bulletMatch) {
      if (!currentList || currentList.type !== "ul") {
        flushList();
        currentList = { type: "ul", items: [] };
      }
      currentList.items.push(parseInline(bulletMatch[1]));
      return;
    }

    const numMatch = line.match(/^\d+\.\s+(.+)/);
    if (numMatch) {
      if (!currentList || currentList.type !== "ol") {
        flushList();
        currentList = { type: "ol", items: [] };
      }
      currentList.items.push(parseInline(numMatch[1]));
      return;
    }

    flushList();
    elements.push(
      <p key={itemKey} className="mb-2 leading-relaxed text-foreground">
        {parseInline(line)}
      </p>
    );
  });

  flushList();

  return <div className="space-y-1 text-sm leading-relaxed">{elements}</div>;
}

/**
 * Grounded chat scoped to one deck.
 */
export function DeckAiChat({ deckId, onOpenCard }: DeckAiChatProps) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);

  async function ask(question: string) {
    const query = question.trim();
    if (!query || pending) return;

    setError(null);
    setDraft("");
    setPending(true);

    const history: ChatMessage[] = turns.map((turn) => ({
      role: turn.role,
      content: turn.content,
    }));

    setTurns((value) => [...value, { role: "user", content: query }]);

    try {
      const answer = await aiChat({
        query,
        scope_deck_id: deckId,
        history,
        options: { top_k: 5, max_output_tokens: 2048 },
      });

      setTurns((value) => [
        ...value,
        {
          role: "assistant",
          content: answer.answer,
          citations: answer.citations?.filter((c) => c.used_in_answer) ?? [],
          rewrittenQuery: answer.rewritten_query,
          answerSource: answer.answer_source,
        },
      ]);
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Không hỏi được AI lúc này. Thử lại sau nhé.",
      );
    } finally {
      setPending(false);
      requestAnimationFrame(() => {
        threadRef.current?.scrollTo({
          top: threadRef.current.scrollHeight,
          behavior: "smooth",
        });
      });
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div
        ref={threadRef}
        className="max-h-[28rem] min-h-64 overflow-y-auto rounded-card border border-line bg-surface p-5"
      >
        {turns.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-base text-muted">
              Hỏi AI về chính bộ thẻ này. Câu trả lời sẽ kèm những thẻ mà nó đã
              dựa vào.
            </p>
            <ul className="mt-5 grid gap-2">
              {STARTERS.map((starter) => (
                <li key={starter}>
                  <button
                    type="button"
                    onClick={() => ask(starter)}
                    className="w-full rounded-field border border-line px-4 py-2.5 text-left transition-colors hover:bg-surface-2"
                  >
                    {starter}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <ul className="grid gap-5">
            {turns.map((turn, turnIndex) => (
              <li
                key={turnIndex}
                className={cn(
                  "grid gap-2",
                  turn.role === "user" ? "justify-items-end" : "",
                )}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-card px-4 py-3",
                    turn.role === "user"
                      ? "bg-accent text-accent-fg"
                      : "bg-surface-2",
                  )}
                >
                  {turn.role === "user" ? (
                    <p className="whitespace-pre-wrap">{turn.content}</p>
                  ) : (
                    <FormattedMarkdown content={turn.content} />
                  )}
                </div>

                {turn.citations?.length ? (
                  <ul className="flex flex-wrap gap-2">
                    {turn.citations.map((citation) => (
                      <li key={citation.card_id}>
                        <button
                          type="button"
                          onClick={() => onOpenCard?.(citation.card_id)}
                          className="rounded-full border border-line px-3 py-2 text-sm transition-colors hover:bg-surface-2"
                        >
                          {citation.word}
                          <span className="ml-1.5 text-muted">
                            {citation.score.toFixed(2)}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}

                {turn.role === "assistant" && turn.rewrittenQuery ? (
                  <details className="text-sm text-muted">
                    <summary className="cursor-pointer py-2.5">
                      AI đã hiểu câu hỏi thành gì
                    </summary>
                    <p className="mt-1.5">
                      Tìm theo: {turn.rewrittenQuery}
                      {turn.answerSource ? ` · nguồn: ${turn.answerSource}` : ""}
                    </p>
                  </details>
                ) : null}
              </li>
            ))}

            {pending ? (
              <li className="text-sm text-muted">AI đang soạn câu trả lời...</li>
            ) : null}
          </ul>
        )}
      </div>

      {error ? (
        <div className="mt-4">
          <ErrorState message={error} />
        </div>
      ) : null}

      <form
        className="mt-4 flex items-center gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          ask(draft);
        }}
      >
        <TextInput
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Hỏi về bộ thẻ này..."
          aria-label="Câu hỏi cho AI"
          disabled={pending}
          className="min-w-0 flex-1"
        />
        <Button type="submit" disabled={pending || !draft.trim()}>
          <PaperPlaneTilt aria-hidden size={16} />
          Gửi
        </Button>
      </form>
    </div>
  );
}
