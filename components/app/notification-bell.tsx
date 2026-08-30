"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError } from "@/lib/api/client";
import {
  deleteNotification,
  getUnreadNotificationCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/api/notifications";
import type { NotificationResponse } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { Bell } from "@phosphor-icons/react/Bell";
import { Trash } from "@phosphor-icons/react/Trash";

/*
  The notification bell.

  What this component can and cannot show is decided by the backend, not by
  taste:

  - The unread COUNT is accurate and is what the badge uses.
  - The per notification `read` flag is hardcoded false in every response, even
    right after marking one read and even though the change persists. So rows
    are NOT drawn as read or unread; doing that would show everything as unread
    forever. Marking read is still offered, and the badge answers correctly
    afterwards, which is the honest half of the feature.
  - The list is a flat array with no total, so there is no page count and no
    "load more" beyond asking for a bigger page. A short page means the end.
*/

const PAGE_SIZE = 15;

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<NotificationResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  /* setState inside .then rather than after an await, matching the pattern in
     lib/use-async.ts: the set-state-in-effect rule reads the effect body
     statically and cannot see that an await defers the call. */
  const refreshCount = useCallback(() => {
    getUnreadNotificationCount()
      .then((value) => setCount(value))
      .catch(() => {
        // A badge that cannot load is not worth interrupting anyone over.
      });
  }, []);

  useEffect(() => {
    refreshCount();
  }, [refreshCount]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!panelRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (!next) return;
    setError(null);
    listNotifications(0, PAGE_SIZE)
      .then((rows) => setItems(rows))
      .catch((e) =>
        setError(e instanceof ApiError ? e.message : "Không tải được thông báo."),
      );
  }

  function markOne(id: number) {
    setBusy(true);
    markNotificationRead(id)
      .then(() => refreshCount())
      .catch(() => undefined)
      .finally(() => setBusy(false));
  }

  function markAll() {
    setBusy(true);
    markAllNotificationsRead()
      .then(() => refreshCount())
      .catch(() => undefined)
      .finally(() => setBusy(false));
  }

  function remove(id: number) {
    setBusy(true);
    deleteNotification(id)
      .then(() => {
        setItems((current) => current?.filter((n) => n.id !== id) ?? null);
        refreshCount();
      })
      .catch(() => undefined)
      .finally(() => setBusy(false));
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-label={
          count > 0 ? `Thông báo, ${count} chưa đọc` : "Thông báo"
        }
        className="relative flex size-10 shrink-0 items-center justify-center rounded-full border border-line text-ink transition-colors hover:bg-surface-2"
      >
        <Bell size={18} weight={count > 0 ? "fill" : "regular"} />
        {count > 0 ? (
          <span className="absolute -top-1 -right-1 flex min-w-5 items-center justify-center rounded-full bg-danger px-1.5 text-xs font-semibold text-paper tabular-nums">
            {count > 99 ? "99+" : count}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-card border border-line bg-surface shadow-card">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <span className="text-sm font-semibold">Thông báo</span>
            <button
              type="button"
              onClick={markAll}
              disabled={busy || count === 0}
              className="text-sm text-accent-text underline underline-offset-4 disabled:opacity-40 disabled:no-underline"
            >
              Đánh dấu đã đọc hết
            </button>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {error ? (
              <p className="px-4 py-6 text-sm text-danger">{error}</p>
            ) : items === null ? (
              <p className="px-4 py-6 text-sm text-muted">Đang tải…</p>
            ) : items.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted">
                Chưa có thông báo nào.
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {items.map((item) => (
                  <li key={item.id} className="flex gap-3 px-4 py-3">
                    <button
                      type="button"
                      onClick={() => markOne(item.id)}
                      disabled={busy}
                      className={cn(
                        "min-w-0 flex-1 text-left",
                        busy && "opacity-60",
                      )}
                    >
                      <p className="truncate text-sm font-medium">{item.title}</p>
                      <p className="text-sm text-muted">{item.content}</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(item.id)}
                      disabled={busy}
                      aria-label={`Xoá thông báo ${item.title}`}
                      className="shrink-0 self-start rounded-full p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-danger disabled:opacity-40"
                    >
                      <Trash size={15} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
