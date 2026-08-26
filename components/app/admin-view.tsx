"use client";

import { useCallback, useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Field, SelectInput, TextInput } from "@/components/ui/field";
import { EmptyState, ErrorState, RowSkeleton } from "@/components/app/states";
import { ApiError } from "@/lib/api/client";
import {
  deleteAdminDeck,
  deleteAdminGameRecord,
  getAdminDashboardStats,
  isAccessDeniedMessage,
  listAdminDecks,
  listAdminGameRecords,
  listAdminUsers,
  setDeckOfficial,
  updateAdminUserRoles,
} from "@/lib/api/admin";
import type { DeckVisibility } from "@/lib/api/types";
import { useAsync } from "@/lib/use-async";
import { cn } from "@/lib/cn";
import { ChartBar } from "@phosphor-icons/react/ChartBar";
import { Users } from "@phosphor-icons/react/Users";
import { Cards } from "@phosphor-icons/react/Cards";
import { GameController } from "@phosphor-icons/react/GameController";
import { Trash } from "@phosphor-icons/react/Trash";
import { SealCheck } from "@phosphor-icons/react/SealCheck";

/*
  The admin console.

  One page with four sections rather than four routes, following the deck
  page's switcher idiom: the sections share filters-and-a-list structure and
  an admin moves between them constantly.

  Access is gated twice over, and neither gate is the real one. The nav entry
  and this page check the session's roles so a non admin is not shown a
  console that cannot work, and the server refuses every call regardless. The
  client check is a courtesy, not security.
*/

type Section = "stats" | "users" | "decks" | "games";

const SECTIONS: { key: Section; label: string; Icon: typeof ChartBar }[] = [
  { key: "stats", label: "Tổng quan", Icon: ChartBar },
  { key: "users", label: "Người dùng", Icon: Users },
  { key: "decks", label: "Bộ thẻ", Icon: Cards },
  { key: "games", label: "Lịch sử game", Icon: GameController },
];

const PAGE_SIZE = 10;

export function AdminView() {
  const [section, setSection] = useState<Section>("stats");

  return (
    <Container className="flex flex-col gap-8 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">Quản trị</h1>
        <p className="max-w-prose text-muted">
          Số liệu toàn hệ thống, tài khoản, bộ thẻ và lịch sử chơi. Mọi thao tác
          ở đây áp dụng cho tất cả người dùng.
        </p>
      </header>

      <nav className="-mx-1 flex gap-1 overflow-x-auto pb-1">
        {SECTIONS.map(({ key, label, Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setSection(key)}
            aria-current={section === key ? "page" : undefined}
            className={cn(
              "inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm transition-colors",
              section === key
                ? "bg-accent text-accent-fg"
                : "text-muted hover:bg-surface-2 hover:text-ink",
            )}
          >
            <Icon aria-hidden size={17} weight={section === key ? "fill" : "regular"} />
            {label}
          </button>
        ))}
      </nav>

      {section === "stats" ? <StatsSection /> : null}
      {section === "users" ? <UsersSection /> : null}
      {section === "decks" ? <DecksSection /> : null}
      {section === "games" ? <GamesSection /> : null}
    </Container>
  );
}

/**
 * Shared failure rendering.
 *
 * A refusal is worded as a permissions problem rather than a fault, because
 * the backend answers HTTP 500 for both and the distinction is invisible in
 * the status code. The message form of the check is used because useAsync
 * surfaces the message, not the ApiError.
 *
 * Retry is offered only for real faults. Retrying a refusal just fails again.
 */
function SectionError({ error, onRetry }: { error: string; onRetry: () => void }) {
  const denied = isAccessDeniedMessage(error);
  return (
    <ErrorState
      message={
        denied
          ? "Tài khoản này không có quyền quản trị."
          : error
      }
      onRetry={denied ? undefined : onRetry}
    />
  );
}

/* --------------------------------- stats --------------------------------- */

const STAT_LABELS: { key: keyof AdminStats; label: string }[] = [
  { key: "totalUsers", label: "Người dùng" },
  { key: "totalDecks", label: "Bộ thẻ" },
  { key: "totalCards", label: "Thẻ" },
  { key: "totalGameRecords", label: "Lượt chơi" },
  { key: "totalOfficialDecks", label: "Bộ thẻ chính thức" },
  { key: "totalPublicDecks", label: "Bộ thẻ công khai" },
];

type AdminStats = {
  totalUsers: number;
  totalDecks: number;
  totalCards: number;
  totalGameRecords: number;
  totalOfficialDecks: number;
  totalPublicDecks: number;
};

function StatsSection() {
  const stats = useAsync(
    useCallback((signal: AbortSignal) => getAdminDashboardStats(signal), []),
    "admin-stats",
  );

  if (stats.status === "loading") return <RowSkeleton count={2} />;
  if (stats.status === "error") {
    return <SectionError error={stats.error} onRetry={stats.reload} />;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {STAT_LABELS.map(({ key, label }) => (
        <div
          key={key}
          className="flex flex-col gap-1 rounded-card border border-line bg-surface p-6"
        >
          <span className="text-sm text-muted">{label}</span>
          <span className="font-mono text-3xl font-semibold tabular-nums">
            {stats.data[key].toLocaleString("vi-VN")}
          </span>
        </div>
      ))}
    </div>
  );
}

/* --------------------------------- users --------------------------------- */

function UsersSection() {
  const [page, setPage] = useState(0);
  const [keyword, setKeyword] = useState("");
  const [role, setRole] = useState("");
  const [busy, setBusy] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);

  const users = useAsync(
    useCallback(
      (signal: AbortSignal) =>
        listAdminUsers(page, PAGE_SIZE, { keyword, role }, signal),
      [page, keyword, role],
    ),
    `admin-users-${page}-${keyword}-${role}`,
  );

  /*
    Roles arrive here as plain strings, unlike the session user's roles, which
    are objects with a name. Both shapes are real; see lib/api/types.ts.
  */
  async function toggleAdmin(userId: string, roles: string[]) {
    const next = roles.includes("ADMIN")
      ? roles.filter((r) => r !== "ADMIN")
      : [...roles, "ADMIN"];
    if (
      !window.confirm(
        next.includes("ADMIN")
          ? "Cấp quyền quản trị cho tài khoản này?"
          : "Thu hồi quyền quản trị của tài khoản này?",
      )
    ) {
      return;
    }
    setBusy(true);
    setRowError(null);
    try {
      await updateAdminUserRoles(userId, { roleNames: next });
      users.reload();
    } catch (error) {
      setRowError(
        error instanceof ApiError ? error.message : "Không đổi được quyền.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="admin-user-keyword" label="Tìm theo tên hoặc email">
          <TextInput
            id="admin-user-keyword"
            value={keyword}
            placeholder="để trống để xem tất cả"
            onChange={(event) => {
              setPage(0);
              setKeyword(event.target.value);
            }}
          />
        </Field>
        <Field id="admin-user-role" label="Lọc theo quyền">
          <SelectInput
            id="admin-user-role"
            value={role}
            onChange={(event) => {
              setPage(0);
              setRole(event.target.value);
            }}
          >
            <option value="">Tất cả</option>
            <option value="USER">USER</option>
            <option value="ADMIN">ADMIN</option>
          </SelectInput>
        </Field>
      </div>

      {rowError ? <ErrorState message={rowError} /> : null}

      {users.status === "loading" ? <RowSkeleton count={5} /> : null}
      {users.status === "error" ? (
        <SectionError error={users.error} onRetry={users.reload} />
      ) : null}

      {users.status === "success" ? (
        users.data.content.length === 0 ? (
          <EmptyState
            title="Không có tài khoản nào khớp"
            body="Thử bỏ bớt điều kiện lọc."
          />
        ) : (
          <>
            <ul className="divide-y divide-line rounded-card border border-line bg-surface">
              {users.data.content.map((user) => (
                <li
                  key={user.id}
                  className="flex flex-wrap items-center justify-between gap-3 p-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {user.fullName || user.email}
                    </p>
                    <p className="truncate text-sm text-muted">{user.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {user.roles.map((name) => (
                      <span
                        key={name}
                        className={cn(
                          "rounded-full px-2.5 py-1 text-xs font-medium",
                          name === "ADMIN"
                            ? "bg-accent-soft text-accent-text"
                            : "bg-surface-2 text-muted",
                        )}
                      >
                        {name}
                      </span>
                    ))}
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() => toggleAdmin(user.id, user.roles)}
                    >
                      {user.roles.includes("ADMIN") ? "Bỏ quản trị" : "Cấp quản trị"}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
            <Pager
              page={page}
              last={users.data.last}
              total={users.data.totalElements}
              onChange={setPage}
            />
          </>
        )
      ) : null}
    </div>
  );
}

/* --------------------------------- decks --------------------------------- */

function DecksSection() {
  const [page, setPage] = useState(0);
  const [keyword, setKeyword] = useState("");
  const [visibility, setVisibility] = useState<"" | DeckVisibility>("");
  const [official, setOfficial] = useState<"" | "true" | "false">("");
  const [busy, setBusy] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);
  const [officialNote, setOfficialNote] = useState<string | null>(null);

  const decks = useAsync(
    useCallback(
      (signal: AbortSignal) =>
        listAdminDecks(
          page,
          PAGE_SIZE,
          {
            keyword,
            visibility: visibility || undefined,
            isOfficial: official === "" ? undefined : official === "true",
          },
          signal,
        ),
      [page, keyword, visibility, official],
    ),
    `admin-decks-${page}-${keyword}-${visibility}-${official}`,
  );

  /*
    The server answers 200 and leaves the flag alone. Verified by writing the
    flag and then re-reading the deck, which is the only way this class of bug
    shows itself. Until the backend is fixed the button reports that rather
    than pretending it worked, because a silent no-op is worse than an error.
  */
  async function toggleOfficial(deckId: number, current: boolean) {
    setBusy(true);
    setRowError(null);
    setOfficialNote(null);
    try {
      const updated = await setDeckOfficial(deckId, { isOfficial: !current });
      if (updated.official === current) {
        setOfficialNote(
          "Máy chủ trả về thành công nhưng cờ chính thức không đổi. Đây là lỗi backend đã được báo, không phải thao tác của bạn.",
        );
      }
      decks.reload();
    } catch (error) {
      setRowError(
        error instanceof ApiError ? error.message : "Không đổi được trạng thái.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function remove(deckId: number, title: string) {
    if (!window.confirm(`Xoá vĩnh viễn bộ thẻ "${title}" và toàn bộ thẻ trong đó?`)) {
      return;
    }
    setBusy(true);
    setRowError(null);
    try {
      await deleteAdminDeck(deckId);
      decks.reload();
    } catch (error) {
      setRowError(
        error instanceof ApiError ? error.message : "Không xoá được bộ thẻ.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field id="admin-deck-keyword" label="Tìm theo tiêu đề">
          <TextInput
            id="admin-deck-keyword"
            value={keyword}
            onChange={(event) => {
              setPage(0);
              setKeyword(event.target.value);
            }}
          />
        </Field>
        <Field id="admin-deck-visibility" label="Phạm vi">
          <SelectInput
            id="admin-deck-visibility"
            value={visibility}
            onChange={(event) => {
              setPage(0);
              setVisibility(event.target.value as "" | DeckVisibility);
            }}
          >
            <option value="">Tất cả</option>
            <option value="PUBLIC">PUBLIC</option>
            <option value="PRIVATE">PRIVATE</option>
            <option value="SHARED">SHARED</option>
          </SelectInput>
        </Field>
        <Field id="admin-deck-official" label="Chính thức">
          <SelectInput
            id="admin-deck-official"
            value={official}
            onChange={(event) => {
              setPage(0);
              setOfficial(event.target.value as "" | "true" | "false");
            }}
          >
            <option value="">Tất cả</option>
            <option value="true">Chỉ bộ chính thức</option>
            <option value="false">Không chính thức</option>
          </SelectInput>
        </Field>
      </div>

      {rowError ? <ErrorState message={rowError} /> : null}
      {officialNote ? (
        <p className="rounded-card border border-line bg-surface-2 p-4 text-sm text-muted">
          {officialNote}
        </p>
      ) : null}

      {decks.status === "loading" ? <RowSkeleton count={5} /> : null}
      {decks.status === "error" ? (
        <SectionError error={decks.error} onRetry={decks.reload} />
      ) : null}

      {decks.status === "success" ? (
        decks.data.content.length === 0 ? (
          <EmptyState
            title="Không có bộ thẻ nào khớp"
            body="Thử bỏ bớt điều kiện lọc."
          />
        ) : (
          <>
            <ul className="divide-y divide-line rounded-card border border-line bg-surface">
              {decks.data.content.map((deck) => (
                <li
                  key={deck.id}
                  className="flex flex-wrap items-center justify-between gap-3 p-4"
                >
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/decks/${deck.id}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {deck.title}
                    </Link>
                    <p className="text-sm text-muted">
                      {deck.visibility} · {deck.totalCards} thẻ
                      {deck.official ? " · chính thức" : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() => toggleOfficial(deck.id, deck.official)}
                    >
                      <SealCheck aria-hidden size={15} weight="bold" />
                      {deck.official ? "Bỏ chính thức" : "Đặt chính thức"}
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() => remove(deck.id, deck.title)}
                    >
                      <Trash aria-hidden size={15} weight="bold" />
                      Xoá
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
            <Pager
              page={page}
              last={decks.data.last}
              total={decks.data.totalElements}
              onChange={setPage}
            />
          </>
        )
      ) : null}
    </div>
  );
}

/* --------------------------------- games --------------------------------- */

function GamesSection() {
  const [page, setPage] = useState(0);
  const [gameType, setGameType] = useState("");
  const [busy, setBusy] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);

  const records = useAsync(
    useCallback(
      (signal: AbortSignal) =>
        listAdminGameRecords(page, PAGE_SIZE, { gameType }, signal),
      [page, gameType],
    ),
    `admin-games-${page}-${gameType}`,
  );

  async function remove(recordId: string) {
    if (!window.confirm("Xoá bản ghi lượt chơi này?")) return;
    setBusy(true);
    setRowError(null);
    try {
      await deleteAdminGameRecord(recordId);
      records.reload();
    } catch (error) {
      setRowError(
        error instanceof ApiError ? error.message : "Không xoá được bản ghi.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <Field
        id="admin-game-type"
        label="Lọc theo loại game"
        hint="Máy chủ không kiểm tra giá trị này, gõ sai sẽ ra danh sách rỗng."
      >
        <TextInput
          id="admin-game-type"
          value={gameType}
          placeholder="ví dụ AUDIO_REFLEX"
          onChange={(event) => {
            setPage(0);
            setGameType(event.target.value);
          }}
        />
      </Field>

      {rowError ? <ErrorState message={rowError} /> : null}

      {records.status === "loading" ? <RowSkeleton count={5} /> : null}
      {records.status === "error" ? (
        <SectionError error={records.error} onRetry={records.reload} />
      ) : null}

      {records.status === "success" ? (
        records.data.content.length === 0 ? (
          <EmptyState
            title="Chưa có lượt chơi nào"
            body="Bản ghi sẽ xuất hiện khi người dùng chơi xong một ván."
          />
        ) : (
          <>
            <ul className="divide-y divide-line rounded-card border border-line bg-surface">
              {records.data.content.map((record) => (
                <li
                  key={record.id}
                  className="flex flex-wrap items-center justify-between gap-3 p-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {record.userFullName || record.userEmail || "Ẩn danh"}
                    </p>
                    <p className="truncate text-sm text-muted">
                      {record.gameType} · {record.deckTitle ?? `deck ${record.deckId}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-mono font-semibold tabular-nums">
                        {record.score.toLocaleString("vi-VN")}
                      </p>
                      <p className="text-xs text-muted tabular-nums">
                        {record.correctCount}/{record.totalCards} ·{" "}
                        {Math.round(record.accuracyRate)}%
                      </p>
                    </div>
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() => remove(record.id)}
                    >
                      <Trash aria-hidden size={15} weight="bold" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
            <Pager
              page={page}
              last={records.data.last}
              total={records.data.totalElements}
              onChange={setPage}
            />
          </>
        )
      ) : null}
    </div>
  );
}

/* --------------------------------- pager --------------------------------- */

/**
 * Admin lists are zero based, unlike the deck routes, so the displayed number
 * is page + 1 while the value sent stays as is. Verified live: page=0 answers
 * pageNo=0 and page=1 answers a different slice.
 *
 * `last` is the end-of-list test rather than comparing pageNo to totalPages,
 * for the reason spelled out on PageResponse in lib/api/types.ts.
 */
function Pager({
  page,
  last,
  total,
  onChange,
}: {
  page: number;
  last: boolean;
  total: number;
  onChange: (page: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-sm text-muted tabular-nums">
        Trang {page + 1} · {total.toLocaleString("vi-VN")} mục
      </p>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          disabled={page === 0}
          onClick={() => onChange(page - 1)}
        >
          Trước
        </Button>
        <Button variant="secondary" disabled={last} onClick={() => onChange(page + 1)}>
          Sau
        </Button>
      </div>
    </div>
  );
}
