"use client";

import { useCallback, useState } from "react";
import { Scroll } from "@phosphor-icons/react/Scroll";
import { CaretRight } from "@phosphor-icons/react/CaretRight";
import { UserCircle } from "@phosphor-icons/react/UserCircle";

import { EmptyState, RowSkeleton } from "@/components/app/states";
import { UserAgentPanel } from "@/components/app/user-agent-view";
import { Pager, SectionError } from "@/components/app/admin-view";
import { adminAiAuditLogs } from "@/lib/api/admin-ai";
import type { AdminAiAuditLog } from "@/lib/api/types";
import { useAsync } from "@/lib/use-async";
import { cn } from "@/lib/cn";

/*
  AI section of the admin console: the Agent User chat plus an audit log
  panel behind a sub-tab switcher, following ModerationSection's idiom.
  The Agent Admin chat lives in its own file; this section hosts only what
  admin needs that the user page does not have.
*/

const AUDIT_LOG_PAGE_SIZE = 10;






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

type AiTab = "agent-user" | "audit";

export function AdminAiSection() {
  const [tab, setTab] = useState<AiTab>("agent-user");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-1 rounded-full border border-line bg-surface p-1 w-fit">
        <button
          type="button"
          onClick={() => setTab("agent-user")}
          className={cn(
            "inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
            tab === "agent-user"
              ? "bg-accent text-accent-fg shadow-2xs"
              : "text-muted hover:text-ink",
          )}
        >
          <UserCircle size={16} />
          Agent User
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

      {tab === "agent-user" ? <UserAgentPanel /> : null}
      {tab === "audit" ? <AdminAiAuditLogPanel /> : null}
    </div>
  );
}