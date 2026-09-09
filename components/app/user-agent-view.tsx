"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PaperPlaneTilt } from "@phosphor-icons/react/PaperPlaneTilt";
import { Robot } from "@phosphor-icons/react/Robot";
import { Trash } from "@phosphor-icons/react/Trash";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { TextInput } from "@/components/ui/field";
import { ErrorState, RowSkeleton } from "@/components/app/states";
import { ApiError } from "@/lib/api/client";
import {
  aiUserChat,
  getUserAiChatHistory,
  resetUserAiChatHistory,
} from "@/lib/api/user-ai-chat";
import { useAsync } from "@/lib/use-async";
import { cn } from "@/lib/cn";

/*
  Agent User: the student-facing AI tutor chat. Same thread idiom as the
  admin chat but simpler: no pending actions, no audit trail. The server
  holds the conversation per profile, so no conversationId is sent back.
*/

const STARTERS = [
  "Tạo cho mình bộ thẻ về tiếng Nhật N5",
  "Thêm từ 'negotiation' vào bộ thẻ tiếng Anh",
  "Mình nên học từ vựng thế nào để nhớ lâu?",
];

type Turn = {
  role: "user" | "assistant";
  content: string;
  /** Tools the assistant called for this turn, shown as chips. */
  toolsCalled?: string[];
};

/** Same lightweight markdown renderer as the admin and deck chats. */
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
          </ul>,
        );
      } else {
        elements.push(
          <ol key={listKey} className="my-2 list-decimal space-y-1 pl-5">
            {currentList.items.map((item, idx) => (
              <li key={`item-${idx}`}>{item}</li>
            ))}
          </ol>,
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
      const inlineKey = `inline-${match.index}`;
      const matchedStr = match[0];
      if (matchedStr.startsWith("**") && matchedStr.endsWith("**")) {
        parts.push(
          <strong key={inlineKey} className="font-semibold text-ink">
            {matchedStr.slice(2, -2)}
          </strong>,
        );
      } else if (matchedStr.startsWith("`") && matchedStr.endsWith("`")) {
        parts.push(
          <code
            key={inlineKey}
            className="rounded bg-surface px-1.5 py-0.5 font-mono text-xs text-accent-text"
          >
            {matchedStr.slice(1, -1)}
          </code>,
        );
      } else if (matchedStr.startsWith("*") && matchedStr.endsWith("*")) {
        parts.push(
          <em key={inlineKey} className="italic">
            {matchedStr.slice(1, -1)}
          </em>,
        );
      }
      lastIdx = regex.lastIndex;
    }

    if (lastIdx < text.length) {
      parts.push(text.substring(lastIdx));
    }
    return parts;
  }

  lines.forEach((line, itemIdx) => {
    const itemKey = `item-${itemIdx}`;

    if (line.startsWith("### ")) {
      flushList();
      elements.push(
        <h4 key={itemKey} className="mt-3 mb-1.5 text-base font-semibold text-ink">
          {parseInline(line.slice(4))}
        </h4>,
      );
      return;
    }
    if (line.startsWith("## ")) {
      flushList();
      elements.push(
        <h3 key={itemKey} className="mt-4 mb-2 text-lg font-bold text-ink">
          {parseInline(line.slice(3))}
        </h3>,
      );
      return;
    }
    if (line.startsWith("# ")) {
      flushList();
      elements.push(
        <h2 key={itemKey} className="mt-4 mb-2 text-xl font-bold text-ink">
          {parseInline(line.slice(2))}
        </h2>,
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
      <p key={itemKey} className="mb-2 leading-relaxed text-ink">
        {parseInline(line)}
      </p>,
    );
  });

  flushList();

  return <div className="space-y-1 text-sm leading-relaxed">{elements}</div>;
}

export function UserAgentPanel() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);

  const history = useAsync(
    useCallback(
      (signal: AbortSignal) => getUserAiChatHistory(signal),
      [],
    ),
    "user-ai-history",
  );

  const [confirmClear, setConfirmClear] = useState(false);

  /* Hydrate the thread once from server-held conversation. Mirrors the admin
     chat: the sync is keyed on history status so a reload with an identical
     cache does not clobber live turns. */
  useEffect(() => {
    if (history.status !== "success") return;
    setTurns((current) => {
      if (current.length > 0) return current;
      return history.data
        .filter((message) => message.role === "user" || message.role === "assistant")
        .map((message) => ({
          role: message.role === "user" ? "user" : "assistant",
          content: message.content,
        }));
    });
  }, [history.status, history.data]);

  useEffect(() => {
    threadRef.current?.scrollTo({
      top: threadRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [turns, sending]);

  async function send(message: string) {
    const query = message.trim();
    if (!query || sending) return;

    setError(null);
    setDraft("");
    setSending(true);
    setTurns((value) => [...value, { role: "user", content: query }]);

    try {
      const answer = await aiUserChat(query);
      setTurns((value) => [
        ...value,
        {
          role: "assistant",
          content: answer.reply,
          toolsCalled: answer.toolsCalled ?? undefined,
        },
      ]);
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Không hỏi được AI lúc này. Thử lại sau nhé.",
      );
    } finally {
      setSending(false);
    }
  }

  async function clearHistory() {
    setConfirmClear(false);
    setError(null);
    try {
      await resetUserAiChatHistory();
      setTurns([]);
      history.reload();
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Không xoá được hội thoại.",
      );
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="max-w-prose text-sm text-muted">
          Gia sư AI của bạn: hỏi đáp bất cứ điều gì, AI có thể tự tạo bộ thẻ
          hoặc thêm từ vựng vào bộ thẻ của bạn khi bạn yêu cầu.
        </p>
        {turns.length > 0 ? (
          <Button
            variant="secondary"
            onClick={() => setConfirmClear(true)}
            className="h-8 shrink-0 px-3 text-xs"
          >
            <Trash aria-hidden size={14} />
            Xoá hội thoại
          </Button>
        ) : null}
      </div>

      <div
        ref={threadRef}
        className="max-h-[32rem] min-h-72 overflow-y-auto rounded-card border border-line bg-surface p-5"
      >
        {history.status === "loading" ? (
          <RowSkeleton count={3} />
        ) : turns.length === 0 ? (
          <div className="py-6 text-center">
            <span className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-accent-soft text-accent-text">
              <Robot aria-hidden size={24} />
            </span>
            <p className="text-sm text-muted">
              Hỏi về cách học, từ vựng, hoặc yêu cầu tạo bộ thẻ — AI tự lo phần
              còn lại.
            </p>
            <ul className="mt-5 grid gap-2">
              {STARTERS.map((starter) => (
                <li key={starter}>
                  <button
                    type="button"
                    onClick={() => send(starter)}
                    className="w-full cursor-pointer rounded-field border border-line px-4 py-2.5 text-left text-sm transition-colors hover:bg-surface-2"
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
                    <>
                      <FormattedMarkdown content={turn.content} />
                      {turn.toolsCalled && turn.toolsCalled.length > 0 ? (
                        <p className="mt-2 border-t border-line pt-2 font-mono text-[0.7rem] text-muted">
                          tools: {turn.toolsCalled.join(", ")}
                        </p>
                      ) : null}
                    </>
                  )}
                </div>
              </li>
            ))}

            {sending ? (
              <li className="text-sm text-muted">AI đang soạn câu trả lời...</li>
            ) : null}
          </ul>
        )}
      </div>

      {error ? <ErrorState message={error} /> : null}

      <form
        className="flex items-center gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          send(draft);
        }}
      >
        <TextInput
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Hỏi gia sư AI..."
          aria-label="Câu hỏi cho gia sư AI"
          disabled={sending}
          className="min-w-0 flex-1"
        />
        <Button type="submit" disabled={sending || !draft.trim()}>
          <PaperPlaneTilt aria-hidden size={16} />
          Gửi
        </Button>
      </form>

      {confirmClear ? (
        <ConfirmDialog
          mode="confirm"
          title="Xoá hội thoại?"
          body="Toàn bộ lịch sử trò chuyện với gia sư AI sẽ bị xoá vĩnh viễn và bộ nhớ hội thoại trên máy chủ cũng được reset."
          confirmLabel="Xoá"
          destructive
          onResolve={(ok) => (ok ? clearHistory() : setConfirmClear(false))}
        />
      ) : null}
    </div>
  );
}