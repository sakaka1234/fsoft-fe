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

/**
 * Grounded chat scoped to one deck.
 *
 * scope_deck_id keeps retrieval inside the deck the reader has open, so
 * citations point at cards they can actually go and look at. The API keeps no
 * conversation state, so the whole thread is resent on every turn; that is
 * also why history lives in component state and not on the server.
 *
 * Citations are filtered to used_in_answer. The response also carries the
 * candidates that were retrieved but not used, and showing those would suggest
 * the answer leaned on cards it never touched.
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
        options: { top_k: 5, max_output_tokens: 600 },
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
      /* After the turn is committed, not before, or it scrolls to the old end. */
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
                  <p className="whitespace-pre-wrap">{turn.content}</p>
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
