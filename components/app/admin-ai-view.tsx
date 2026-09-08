"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PaperPlaneTilt } from "@phosphor-icons/react/PaperPlaneTilt";
import { Robot } from "@phosphor-icons/react/Robot";
import { Trash } from "@phosphor-icons/react/Trash";
import { Warning } from "@phosphor-icons/react/Warning";
import { Scroll } from "@phosphor-icons/react/Scroll";
import { CaretRight } from "@phosphor-icons/react/CaretRight";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { TextInput } from "@/components/ui/field";
import { EmptyState, ErrorState, RowSkeleton } from "@/components/app/states";
import { Pager, SectionError } from "@/components/app/admin-view";
import { ApiError } from "@/lib/api/client";
import {
  adminAiAuditLogs,
  adminAiChat,
  adminAiChatHistory,
  adminAiClearChatHistory,
  adminAiConfirm,
  adminAiConfirmCancel,
} from "@/lib/api/admin-ai";
import type {
  AdminAiAuditLog,
  AdminAiPendingAction,
} from "@/lib/api/types";
import { useAsync } from "@/lib/use-async";
import { cn } from "@/lib/cn";

/*
  Trợ lý AI section of the admin console: one chat panel and one audit log
  panel behind a sub-tab switcher, following ModerationSection's idiom.

  The chat is a plain request/response loop with a server-held thread; the
  pendingAction card in the flow is the heart of it: a dangerous action the
  bot drafted waits for an explicit confirm or cancel, with a countdown from
  expiresAt. The composer stays disabled while an action is pending.
*/

const CHAT_HISTORY_PAGE_SIZE = 50;
const AUDIT_LOG_PAGE_SIZE = 10;

const STARTERS = [
  "Tổng quan hệ thống hôm nay",
  "Có bộ thẻ nào đang chờ duyệt không?",
  "Liệt kê 5 người dùng mới nhất",
];

type Turn = {
  role: "user" | "assistant";
  content: string;
  /** Drafted-but-not-executed action attached to this assistant turn. */
  pendingAction?: AdminAiPendingAction;
  /** Set once the action is confirmed, cancelled or expired. */
  actionOutcome?: "confirmed" | "cancelled" | "expired";
  /** Inline failure for confirm/cancel on this turn. */
  actionError?: string;
};

/** Same lightweight markdown renderer as the deck chat, reshared here. */
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
        <h4 key={itemKey} className="mt-3 mb-1.5 font-semibold text-base text-ink">
          {parseInline(line.slice(4))}
        </h4>,
      );
      return;
    }
    if (line.startsWith("## ")) {
      flushList();
      elements.push(
        <h3 key={itemKey} className="mt-4 mb-2 font-bold text-lg text-ink">
          {parseInline(line.slice(3))}
        </h3>,
      );
      return;
    }
    if (line.startsWith("# ")) {
      flushList();
      elements.push(
        <h2 key={itemKey} className="mt-4 mb-2 font-bold text-xl text-ink">
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

/** MM:SS left until the ISO deadline; ticks once per second. */
function useCountdown(expiresAt: string | undefined) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!expiresAt) return;
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt]);

  if (!expiresAt) return 0;
  const deadline = new Date(expiresAt).getTime();
  if (Number.isNaN(deadline)) return 0;
  return Math.max(0, Math.floor((deadline - now) / 1000));
}

function formatClock(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

type PendingActionCardProps = {
  action: AdminAiPendingAction;
  outcome?: "confirmed" | "cancelled" | "expired";
  error?: string;
  /** A confirm/cancel request for this card is in flight. */
  resolving: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

function PendingActionCard({
  action,
  outcome,
  error,
  resolving,
  onConfirm,
  onCancel,
}: PendingActionCardProps) {
  const secondsLeft = useCountdown(outcome ? undefined : action.expiresAt);
  const expired = outcome === "expired" || (!outcome && secondsLeft === 0);

  const statusLine = outcome === "confirmed"
    ? "Đã thực hiện."
    : outcome === "cancelled"
      ? "Đã huỷ."
      : expired
        ? "Đã hết hạn chờ xác nhận."
        : null;

  return (
    <div
      className={cn(
        "mt-2 max-w-[85%] rounded-card border p-4",
        outcome === "confirmed"
          ? "border-emerald-500/30 bg-emerald-500/5"
          : outcome
            ? "border-line bg-surface-2"
            : "border-amber-500/40 bg-amber-500/10",
      )}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-start gap-2.5">
        <Warning
          aria-hidden
          size={18}
          weight="fill"
          className={cn(
            "mt-0.5 shrink-0",
            outcome === "confirmed"
              ? "text-emerald-500"
              : outcome || expired
                ? "text-muted"
                : "text-amber-500",
          )}
        />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400">
            Hành động chờ xác nhận
          </p>
          <p className="mt-0.5 font-mono text-xs text-muted">{action.tool}</p>
          <div className="mt-1.5 text-sm text-ink">
            <FormattedMarkdown content={action.summary} />
          </div>
          {error ? (
            <p className="mt-2 rounded-field bg-danger/10 px-2.5 py-1.5 text-xs font-medium text-danger">
              {error}
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {outcome || expired ? (
              <span className="text-xs font-medium text-muted">
                {statusLine}
              </span>
            ) : (
              <>
                <Button
                  variant="secondary"
                  onClick={onCancel}
                  disabled={resolving}
                  className="h-8 px-3 text-xs"
                >
                  Huỷ
                </Button>
                <Button
                  onClick={onConfirm}
                  disabled={resolving}
                  className={cn(
                    "h-8 px-3 text-xs",
                    "bg-amber-600 text-white hover:bg-amber-700",
                  )}
                >
                  {resolving ? "Đang xử lý..." : "Xác nhận"}
                </Button>
                <span className="ml-auto font-mono text-xs tabular-nums text-muted">
                  Hết hạn sau {formatClock(secondsLeft)}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function AdminAiChatPanel() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const conversationIdRef = useRef<string | undefined>(undefined);
  const threadRef = useRef<HTMLDivElement>(null);

  const history = useAsync(
    useCallback(
      (signal: AbortSignal) =>
        adminAiChatHistory(1, CHAT_HISTORY_PAGE_SIZE, signal),
      [],
    ),
    "admin-ai-history",
  );

  const [confirmClear, setConfirmClear] = useState(false);

  /* Hydrate the thread once. Live-verified: chronological, oldest first. */
  useEffect(() => {
    if (history.status !== "success") return;
    setTurns((current) => {
      if (current.length > 0) return current;
      const hydrated: Turn[] = history.data
        .filter((message) => message.role === "user" || message.role === "assistant")
        .map((message) => ({
          role: message.role === "user" ? "user" : "assistant",
          content: message.content,
        }));
      return hydrated;
    });
  }, [history]);

  const hasPending = turns.some(
    (turn) => turn.pendingAction && !turn.actionOutcome && !turn.actionError,
  );

  useEffect(() => {
    threadRef.current?.scrollTo({
      top: threadRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [turns, sending]);

  async function send(message: string) {
    const query = message.trim();
    if (!query || sending || hasPending) return;

    setError(null);
    setDraft("");
    setSending(true);
    setTurns((value) => [...value, { role: "user", content: query }]);

    try {
      const answer = await adminAiChat({
        message: query,
        conversationId: conversationIdRef.current,
      });
      conversationIdRef.current = answer.conversationId;
      setTurns((value) => [
        ...value,
        {
          role: "assistant",
          content: answer.reply,
          pendingAction: answer.pendingAction ?? undefined,
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

  async function resolveAction(
    turnIndex: number,
    action: AdminAiPendingAction,
    mode: "confirm" | "cancel",
  ) {
    setResolvingId(action.actionId);
    setTurns((value) =>
      value.map((turn, idx) =>
        idx === turnIndex ? { ...turn, actionError: undefined } : turn,
      ),
    );
    try {
      const answer =
        mode === "confirm"
          ? await adminAiConfirm(action.actionId)
          : await adminAiConfirmCancel(action.actionId);
      conversationIdRef.current = answer.conversationId ?? conversationIdRef.current;
      setTurns((value) =>
        value.map((turn, idx) =>
          idx === turnIndex
            ? {
                ...turn,
                pendingAction: undefined,
                actionOutcome: mode === "confirm" ? "confirmed" : "cancelled",
                content:
                  mode === "confirm" && (answer.reply || answer.result)
                    ? answer.result || answer.reply
                    : turn.content,
              }
            : turn,
        ),
      );
    } catch (cause) {
      setTurns((value) =>
        value.map((turn, idx) =>
          idx === turnIndex
            ? {
                ...turn,
                actionError:
                  cause instanceof ApiError
                    ? cause.message
                    : "Không xử lý được hành động.",
              }
            : turn,
        ),
      );
    } finally {
      setResolvingId(null);
    }
  }

  async function clearHistory() {
    setConfirmClear(false);
    setError(null);
    try {
      await adminAiClearChatHistory();
      conversationIdRef.current = undefined;
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

  const composerDisabled = sending || hasPending;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="max-w-prose text-sm text-muted">
          Hỏi bằng tiếng Việt hoặc tiếng Anh. Với hành động nhạy cảm, AI chỉ
          soạn sẵn — bạn phải bấm Xác nhận thì nó mới chạy thật.
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
              Hỏi về số liệu, bộ thẻ, người dùng. Hành động nguy hiểm sẽ chờ
              bạn xác nhận.
            </p>
            <ul className="mt-5 grid gap-2">
              {STARTERS.map((starter) => (
                <li key={starter}>
                  <button
                    type="button"
                    onClick={() => send(starter)}
                    className="w-full rounded-field border border-line px-4 py-2.5 text-left text-sm transition-colors hover:bg-surface-2"
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

                {turn.pendingAction && turn.role === "assistant" ? (
                  <PendingActionCard
                    action={turn.pendingAction}
                    outcome={turn.actionOutcome}
                    error={turn.actionError}
                    resolving={resolvingId === turn.pendingAction.actionId}
                    onConfirm={() =>
                      resolveAction(turnIndex, turn.pendingAction!, "confirm")
                    }
                    onCancel={() =>
                      resolveAction(turnIndex, turn.pendingAction!, "cancel")
                    }
                  />
                ) : null}

                {turn.role === "assistant" && turn.actionOutcome === "cancelled" ? (
                  <p className="text-xs text-muted">
                    Đã huỷ hành động, không có gì thay đổi.
                  </p>
                ) : null}
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
          placeholder={
            hasPending
              ? "Hành động đang chờ xác nhận hoặc huỷ..."
              : "Hỏi trợ lý AI..."
          }
          aria-label="Câu hỏi cho trợ lý AI"
          disabled={composerDisabled}
          className="min-w-0 flex-1"
        />
        <Button type="submit" disabled={composerDisabled || !draft.trim()}>
          <PaperPlaneTilt aria-hidden size={16} />
          Gửi
        </Button>
      </form>

      {confirmClear ? (
        <ConfirmDialog
          mode="confirm"
          title="Xoá hội thoại?"
          body="Toàn bộ lịch sử trò chuyện với AI sẽ bị xoá vĩnh viễn và bộ nhớ hội thoại trên máy chủ cũng được reset."
          confirmLabel="Xoá"
          destructive
          onResolve={(ok) => (ok ? clearHistory() : setConfirmClear(false))}
        />
      ) : null}
    </div>
  );
}

const AUDIT_STATUS_STYLES: Record<
  string,
  { dot: string; label: string }
> = {
  EXECUTED: {
    dot: "bg-emerald-500",
    label: "text-emerald-600 dark:text-emerald-400",
  },
  CANCELLED: { dot: "bg-muted", label: "text-muted" },
  FAILED: { dot: "bg-danger", label: "text-danger" },
};

function AuditStatusBadge({ status }: { status: string }) {
  const style = AUDIT_STATUS_STYLES[status] ?? {
    dot: "bg-muted",
    label: "text-muted",
  };
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
      <span aria-hidden className={cn("size-2 rounded-full", status && style.dot)} />
      <span className={style.label}>{status}</span>
    </span>
  );
}

/** Pretty JSON when params parses, raw text when it does not. */
function AuditParams({ params }: { params: string }) {
  const value = params?.trim();
  if (!value) return <p className="text-xs text-muted">Không có tham số.</p>;

  let pretty: string | null = null;
  if (value.startsWith("{") || value.startsWith("[")) {
    try {
      pretty = JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      pretty = null;
    }
  }

  return (
    <pre className="mt-1.5 max-w-full overflow-x-auto rounded-field bg-surface-2 p-3 font-mono text-xs break-all whitespace-pre-wrap text-ink">
      {pretty ?? value}
    </pre>
  );
}

function AuditLogRow({ log }: { log: AdminAiAuditLog }) {
  const when = new Date(log.createdAt);
  return (
    <li className="flex flex-col gap-2 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-surface-2 px-2.5 py-0.5 font-mono text-xs font-semibold text-ink">
            {log.action}
          </span>
          <AuditStatusBadge status={log.status} />
        </div>
        <time className="text-xs text-muted tabular-nums">
          {isNaN(when.getTime())
            ? log.createdAt
            : when.toLocaleString("vi-VN", {
                hour: "2-digit",
                minute: "2-digit",
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              })}
        </time>
      </div>

      <p className="text-sm text-ink/80">
        {log.resultSummary?.trim() ? log.resultSummary : "—"}
      </p>

      {log.referenceId || log.params ? (
        <details className="text-xs text-muted">
          <summary className="inline-flex cursor-pointer items-center gap-1 py-1.5 hover:text-ink">
            <CaretRight size={12} className="transition-transform details-open:rotate-90" />
            Tham số &amp; chi tiết
          </summary>
          <div className="mt-1.5 flex flex-col gap-2">
            {log.referenceId ? (
              <p>
                referenceId:{" "}
                <span className="font-mono text-ink">{log.referenceId}</span>
              </p>
            ) : null}
            <AuditParams params={log.params} />
          </div>
        </details>
      ) : null}
    </li>
  );
}

function AdminAiAuditLogPanel() {
  const [page, setPage] = useState(0);

  const logs = useAsync(
    useCallback(
      (signal: AbortSignal) =>
        adminAiAuditLogs(page + 1, AUDIT_LOG_PAGE_SIZE, signal),
      [page],
    ),
    `admin-ai-audit-${page}`,
  );

  return (
    <div className="flex flex-col gap-5">
      <p className="max-w-prose text-sm text-muted">
        Mỗi hành động AI đã thực thi, huỷ hay lỗi đều được ghi lại tại đây —
        mới nhất trước.
      </p>

      {logs.status === "loading" ? <RowSkeleton count={5} /> : null}
      {logs.status === "error" ? (
        <SectionError error={logs.error} onRetry={logs.reload} />
      ) : null}

      {logs.status === "success" ? (
        logs.data.content.length === 0 ? (
          <EmptyState
            title="Chưa có hành động AI nào được thực hiện"
            body="Khi bạn xác nhận hoặc huỷ một hành động của AI, nó sẽ được ghi lại ở đây."
          />
        ) : (
          <>
            <p className="text-sm text-muted">
              {logs.data.totalElements.toLocaleString("vi-VN")} hành động
            </p>
            <ul className="divide-y divide-line rounded-card border border-line bg-surface">
              {logs.data.content.map((log) => (
                <AuditLogRow key={log.id} log={log} />
              ))}
            </ul>
            <Pager
              page={page}
              last={logs.data.content.length < AUDIT_LOG_PAGE_SIZE}
              total={logs.data.totalElements}
              onChange={setPage}
            />
          </>
        )
      ) : null}
    </div>
  );
}

type AiTab = "chat" | "audit";

export function AdminAiSection() {
  const [tab, setTab] = useState<AiTab>("chat");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-1 rounded-full border border-line bg-surface p-1 w-fit">
        <button
          type="button"
          onClick={() => setTab("chat")}
          className={cn(
            "inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
            tab === "chat"
              ? "bg-accent text-accent-fg shadow-2xs"
              : "text-muted hover:text-ink",
          )}
        >
          <Robot size={16} />
          Trợ lý
        </button>
        <button
          type="button"
          onClick={() => setTab("audit")}
          className={cn(
            "inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
            tab === "audit"
              ? "bg-accent text-accent-fg shadow-2xs"
              : "text-muted hover:text-ink",
          )}
        >
          <Scroll size={16} />
          Nhật ký
        </button>
      </div>

      {tab === "chat" ? <AdminAiChatPanel /> : <AdminAiAuditLogPanel />}
    </div>
  );
}