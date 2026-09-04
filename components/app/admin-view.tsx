"use client";

import { useCallback, useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Field, TextInput } from "@/components/ui/field";
import { SelectDropdown } from "@/components/ui/select-dropdown";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState, ErrorState, RowSkeleton } from "@/components/app/states";
import { ApiError } from "@/lib/api/client";
import {
  approvePublicDeck,
  createAdminTag,
  deleteAdminDeck,
  deleteAdminTag,
  listAdminTags,
  listPendingCommunityPosts,
  listPendingPublicDecks,
  moderateCommunityPost,
  renameAdminTag,
  deleteAdminGameRecord,
  getAdminDashboardStats,
  isAccessDeniedMessage,
  listAdminDecks,
  listAdminGameRecords,
  listAdminUsers,
  setDeckOfficial,
  setDeckVisibility,
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
import { Tag } from "@phosphor-icons/react/Tag";
import { Globe } from "@phosphor-icons/react/Globe";
import { ChatCircleText } from "@phosphor-icons/react/ChatCircleText";
import { Check } from "@phosphor-icons/react/Check";
import { X } from "@phosphor-icons/react/X";
import { CreditCard } from "@phosphor-icons/react/CreditCard";

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

type Section = "stats" | "users" | "decks" | "games" | "tags" | "moderation";

const SECTIONS: { key: Section; label: string; Icon: typeof ChartBar }[] = [
  { key: "stats", label: "Tổng quan", Icon: ChartBar },
  { key: "users", label: "Người dùng", Icon: Users },
  { key: "decks", label: "Bộ thẻ", Icon: Cards },
  { key: "games", label: "Lịch sử game", Icon: GameController },
  { key: "tags", label: "Tag", Icon: Tag },
  { key: "moderation", label: "Chờ duyệt", Icon: SealCheck },
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
      {section === "tags" ? <TagsSection /> : null}
      {section === "moderation" ? <ModerationSection /> : null}
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

type AdminStats = {
  totalUsers: number;
  totalDecks: number;
  totalCards: number;
  totalGameRecords: number;
  totalOfficialDecks: number;
  totalPublicDecks: number;
};

const STAT_ITEMS: {
  key: keyof AdminStats;
  label: string;
  description: string;
  Icon: typeof Users;
  iconBg: string;
}[] = [
  {
    key: "totalUsers",
    label: "Người dùng",
    description: "Tổng tài khoản đã đăng ký",
    Icon: Users,
    iconBg: "bg-blue-500/12 text-blue-500 dark:bg-blue-400/20 dark:text-blue-400",
  },
  {
    key: "totalDecks",
    label: "Bộ thẻ",
    description: "Tổng số bộ flashcard",
    Icon: Cards,
    iconBg: "bg-amber-500/12 text-amber-500 dark:bg-amber-400/20 dark:text-amber-400",
  },
  {
    key: "totalCards",
    label: "Tổng số thẻ",
    description: "Thẻ từ vựng trong hệ thống",
    Icon: CreditCard,
    iconBg: "bg-emerald-500/12 text-emerald-500 dark:bg-emerald-400/20 dark:text-emerald-400",
  },
  {
    key: "totalGameRecords",
    label: "Lượt chơi game",
    description: "Ván game đã hoàn thành",
    Icon: GameController,
    iconBg: "bg-purple-500/12 text-purple-500 dark:bg-purple-400/20 dark:text-purple-400",
  },
  {
    key: "totalOfficialDecks",
    label: "Bộ thẻ chính thức",
    description: "Bộ bài chuẩn do hệ thống tạo",
    Icon: SealCheck,
    iconBg: "bg-accent-soft text-accent dark:bg-accent-soft dark:text-accent",
  },
  {
    key: "totalPublicDecks",
    label: "Bộ thẻ công khai",
    description: "Bộ bài chia sẻ cho cộng đồng",
    Icon: Globe,
    iconBg: "bg-cyan-500/12 text-cyan-500 dark:bg-cyan-400/20 dark:text-cyan-400",
  },
];

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
      {STAT_ITEMS.map(({ key, label, description, Icon, iconBg }) => (
        <div
          key={key}
          className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-line bg-surface p-5 sm:p-6 transition-all duration-200 hover:border-ink/20 hover:shadow-sm"
        >
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-muted">{label}</span>
            <div
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-110",
                iconBg,
              )}
            >
              <Icon size={22} weight="duotone" />
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <div
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg sm:hidden",
                iconBg,
              )}
            >
              <Icon size={18} weight="bold" />
            </div>
            <span className="font-mono text-3xl sm:text-4xl font-bold tracking-tight text-ink tabular-nums">
              {stats.data[key].toLocaleString("vi-VN")}
            </span>
          </div>

          <p className="mt-2 text-xs text-muted">
            {description}
          </p>
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
          <SelectDropdown
            id="admin-user-role"
            value={role}
            options={[
              { value: "", label: "Tất cả" },
              { value: "USER", label: "USER" },
              { value: "ADMIN", label: "ADMIN" },
            ]}
            onValueChange={(v) => {
              setPage(0);
              setRole(v);
            }}
          />
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

  async function toggleVisibility(deckId: number, current: DeckVisibility) {
    const next: DeckVisibility = current === "PUBLIC" ? "PRIVATE" : "PUBLIC";
    setBusy(true);
    setRowError(null);
    try {
      await setDeckVisibility(deckId, { visibility: next });
      decks.reload();
    } catch (error) {
      setRowError(
        error instanceof ApiError ? error.message : "Không đổi được quyền riêng tư.",
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
          <SelectDropdown
            id="admin-deck-visibility"
            value={visibility}
            options={[
              { value: "", label: "Tất cả" },
              { value: "PUBLIC", label: "PUBLIC" },
              { value: "PRIVATE", label: "PRIVATE" },
              { value: "SHARED", label: "SHARED" },
            ]}
            onValueChange={(v) => {
              setPage(0);
              setVisibility(v as "" | DeckVisibility);
            }}
          />
        </Field>
        <Field id="admin-deck-official" label="Chính thức">
          <SelectDropdown
            id="admin-deck-official"
            value={official}
            options={[
              { value: "", label: "Tất cả" },
              { value: "true", label: "Chỉ bộ chính thức" },
              { value: "false", label: "Không chính thức" },
            ]}
            onValueChange={(v) => {
              setPage(0);
              setOfficial(v as "" | "true" | "false");
            }}
          />
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
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() => toggleVisibility(deck.id, deck.visibility)}
                      title="Chuyển đổi trạng thái Public/Private"
                    >
                      <Globe aria-hidden size={15} weight="bold" />
                      {deck.visibility === "PUBLIC" ? "Làm Private" : "Làm Public"}
                    </Button>
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

/* ------------------------------ game records ------------------------------ */

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

/* --------------------------------- tags ---------------------------------- */

/**
 * Tag management.
 *
 * This lives here rather than on the ordinary Tags page because the backend
 * moved it: PUT and DELETE /tags/{id} were removed and now answer the "No
 * static resource" flavour of 500, while /admin/tags/{id} works. The Tags page
 * still shows the same controls to an admin, calling the same functions.
 *
 * Unlike every other admin list this one takes no pagination at all.
 */
function TagsSection() {
  const [busy, setBusy] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");

  const tags = useAsync(
    useCallback((signal: AbortSignal) => listAdminTags(signal), []),
    "admin-tags",
  );

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setRowError(null);
    try {
      await action();
      tags.reload();
    } catch (error) {
      setRowError(
        error instanceof ApiError ? error.message : "Thao tác không thành công.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const name = newName.trim();
          if (!name) return;
          run(async () => {
            await createAdminTag({ name });
            setNewName("");
          });
        }}
        noValidate
        className="flex items-end gap-3"
      >
        <Field id="admin-tag-new" label="Thêm tag" className="min-w-0 flex-1">
          <TextInput
            id="admin-tag-new"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            disabled={busy}
          />
        </Field>
        <Button type="submit" disabled={busy || !newName.trim()}>
          Thêm
        </Button>
      </form>

      {rowError ? <ErrorState message={rowError} /> : null}

      {tags.status === "loading" ? <RowSkeleton count={4} /> : null}
      {tags.status === "error" ? (
        <SectionError error={tags.error} onRetry={tags.reload} />
      ) : null}

      {tags.status === "success" ? (
        tags.data.length === 0 ? (
          <EmptyState title="Chưa có tag nào" body="Thêm tag đầu tiên ở trên." />
        ) : (
          <ul className="divide-y divide-line rounded-card border border-line bg-surface">
            {tags.data.map((tag) => (
              <li key={tag.id} className="flex items-center gap-3 p-4">
                {editingId === tag.id ? (
                  <>
                    <TextInput
                      value={editingName}
                      onChange={(event) => setEditingName(event.target.value)}
                      disabled={busy}
                      className="min-w-0 flex-1"
                      aria-label={`Đổi tên ${tag.name}`}
                    />
                    <Button
                      disabled={busy || !editingName.trim()}
                      onClick={() =>
                        run(async () => {
                          await renameAdminTag(tag.id, {
                            name: editingName.trim(),
                          });
                          setEditingId(null);
                        })
                      }
                    >
                      Lưu
                    </Button>
                    <Button variant="secondary" onClick={() => setEditingId(null)}>
                      Huỷ
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="flex-1">{tag.name}</span>
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() => {
                        setEditingId(tag.id);
                        setEditingName(tag.name);
                      }}
                    >
                      Đổi tên
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() => {
                        if (!window.confirm(`Xoá tag "${tag.name}"?`)) return;
                        run(() => deleteAdminTag(tag.id));
                      }}
                    >
                      <Trash aria-hidden size={15} weight="bold" />
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )
      ) : null}
    </div>
  );
}

/* ------------------------------- moderation ------------------------------ */

type ModerationTab = "decks" | "posts";

function ModerationSection() {
  const [tab, setTab] = useState<ModerationTab>("decks");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-1 rounded-full border border-line bg-surface p-1 w-fit">
        <button
          type="button"
          onClick={() => setTab("decks")}
          className={cn(
            "inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
            tab === "decks"
              ? "bg-accent text-accent-fg shadow-2xs"
              : "text-muted hover:text-ink",
          )}
        >
          <Cards size={16} />
          Bộ thẻ chờ duyệt
        </button>
        <button
          type="button"
          onClick={() => setTab("posts")}
          className={cn(
            "inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
            tab === "posts"
              ? "bg-accent text-accent-fg shadow-2xs"
              : "text-muted hover:text-ink",
          )}
        >
          <ChatCircleText size={16} />
          Bài viết cộng đồng chờ duyệt
        </button>
      </div>

      {tab === "decks" ? <DecksModeration /> : <PostsModeration />}
    </div>
  );
}

function DecksModeration() {
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);

  const pending = useAsync(
    useCallback(
      (signal: AbortSignal) => listPendingPublicDecks(page, PAGE_SIZE, signal),
      [page],
    ),
    `admin-pending-decks-${page}`,
  );

  const [pendingDecision, setPendingDecision] = useState<{
    deckId: number;
    title: string;
    approved: boolean;
  } | null>(null);

  async function decide(deckId: number, approved: boolean, title: string) {
    setPendingDecision({ deckId, title, approved });
  }

  async function applyDeckDecision(approved: boolean) {
    if (!pendingDecision) return;
    const { deckId } = pendingDecision;
    setPendingDecision(null);
    setBusy(true);
    setRowError(null);
    try {
      await approvePublicDeck(deckId, approved);
      pending.reload();
    } catch (error) {
      setRowError(
        error instanceof ApiError ? error.message : "Không xử lý được.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="max-w-prose text-sm text-muted">
        Bộ thẻ do người dùng gửi lên chờ duyệt hiển thị công khai. Duyệt hoặc từ
        chối đều áp dụng ngay.
      </p>

      {rowError ? <ErrorState message={rowError} /> : null}

      {pending.status === "loading" ? <RowSkeleton count={4} /> : null}
      {pending.status === "error" ? (
        <SectionError error={pending.error} onRetry={pending.reload} />
      ) : null}

      {pending.status === "success" ? (
        pending.data.content.length === 0 ? (
          <EmptyState
            title="Không có bộ thẻ nào chờ duyệt"
            body="Khi có người gửi bộ thẻ xin hiển thị công khai, nó sẽ xuất hiện ở đây."
          />
        ) : (
          <>
            <ul className="divide-y divide-line rounded-card border border-line bg-surface">
              {pending.data.content.map((deck) => (
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
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      disabled={busy}
                      onClick={() => decide(deck.id, true, deck.title)}
                    >
                      <Check aria-hidden size={15} weight="bold" />
                      Duyệt
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() => decide(deck.id, false, deck.title)}
                    >
                      <X aria-hidden size={15} weight="bold" />
                      Từ chối
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
            <Pager
              page={page}
              last={pending.data.content.length < PAGE_SIZE}
              total={pending.data.totalElements}
              onChange={setPage}
            />
          </>
        )
      ) : null}

      {pendingDecision ? (
        pendingDecision.approved ? (
          <ConfirmDialog
            mode="confirm"
            title="Duyệt bộ thẻ?"
            body={`Bộ thẻ "${pendingDecision.title}" sẽ hiển thị công khai cho mọi thành viên.`}
            confirmLabel="Duyệt"
            onResolve={(ok) => (ok ? applyDeckDecision(true) : setPendingDecision(null))}
          />
        ) : (
          <ConfirmDialog
            mode="confirm"
            title="Từ chối bộ thẻ?"
            body={`Bộ thẻ "${pendingDecision.title}" sẽ không được hiển thị công khai.`}
            confirmLabel="Từ chối"
            destructive
            onResolve={(ok) => (ok ? applyDeckDecision(false) : setPendingDecision(null))}
          />
        )
      ) : null}
    </div>
  );
}

function PostsModeration() {
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);

  const pending = useAsync(
    useCallback(
      (signal: AbortSignal) =>
        listPendingCommunityPosts(page, PAGE_SIZE, signal),
      [page],
    ),
    `admin-pending-posts-${page}`,
  );

  const [decision, setDecision] = useState<{
    postId: number;
    title: string;
    approved: boolean;
  } | null>(null);

  async function decide(postId: number, approved: boolean, title: string) {
    setDecision({ postId, title, approved });
  }

  async function applyDecision(reason: string | undefined) {
    if (!decision) return;
    const { postId, approved } = decision;
    setDecision(null);

    setBusy(true);
    setRowError(null);
    try {
      await moderateCommunityPost(postId, {
        status: approved ? "APPROVED" : "REJECTED",
        reason,
      });
      pending.reload();
    } catch (error) {
      setRowError(
        error instanceof ApiError ? error.message : "Không xử lý được bài viết.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="max-w-prose text-sm text-muted">
        Bài viết do thành viên đăng lên bảng tin cộng đồng đang ở trạng thái chờ
        kiểm duyệt.
      </p>

      {rowError ? <ErrorState message={rowError} /> : null}

      {pending.status === "loading" ? <RowSkeleton count={4} /> : null}
      {pending.status === "error" ? (
        <SectionError error={pending.error} onRetry={pending.reload} />
      ) : null}

      {pending.status === "success" ? (
        pending.data.content.length === 0 ? (
          <EmptyState
            title="Không có bài viết nào chờ duyệt"
            body="Khi người dùng đăng bài viết mới vào cộng đồng, nó sẽ hiển thị tại đây để bạn kiểm duyệt."
          />
        ) : (
          <>
            <ul className="divide-y divide-line rounded-card border border-line bg-surface">
              {pending.data.content.map((post) => (
                <li
                  key={post.id}
                  className="flex flex-col gap-3 p-5 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0 flex-1 flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-xs text-muted">
                      <span className="font-semibold text-ink">
                        {post.profileName || "Ẩn danh"}
                      </span>
                      <span>·</span>
                      <span>
                        {new Date(post.createdAt).toLocaleDateString("vi-VN", {
                          hour: "2-digit",
                          minute: "2-digit",
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })}
                      </span>
                    </div>

                    <h4 className="text-base font-semibold text-ink">
                      {post.title}
                    </h4>

                    <p className="text-sm text-ink/80 whitespace-pre-line line-clamp-3">
                      {post.content}
                    </p>

                    {post.deckTitle && post.deckId ? (
                      <div className="flex items-center gap-1.5 text-xs text-accent-text mt-1">
                        <Cards size={14} />
                        <span>Bộ thẻ đính kèm: </span>
                        <Link
                          href={`/decks/${post.deckId}`}
                          className="font-medium underline hover:text-accent-hover"
                        >
                          {post.deckTitle}
                        </Link>
                      </div>
                    ) : null}

                    {post.tags && post.tags.length > 0 ? (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {post.tags.map((t) => (
                          <span
                            key={t.id}
                            className="rounded-full bg-surface-2 px-2 py-0.5 text-2xs text-muted"
                          >
                            #{t.name}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-start shrink-0 pt-2 sm:pt-0">
                    <Button
                      disabled={busy}
                      onClick={() => decide(post.id, true, post.title)}
                    >
                      <Check aria-hidden size={15} weight="bold" />
                      Duyệt
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() => decide(post.id, false, post.title)}
                    >
                      <X aria-hidden size={15} weight="bold" />
                      Từ chối
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
            <Pager
              page={page}
              last={pending.data.content.length < PAGE_SIZE}
              total={pending.data.totalElements}
              onChange={setPage}
            />
          </>
        )
      ) : null}

      {decision ? (
        decision.approved ? (
          <ConfirmDialog
            mode="confirm"
            title="Duyệt bài viết?"
            body={`Bài viết "${decision.title}" sẽ được đăng công khai lên cộng đồng.`}
            confirmLabel="Duyệt"
            onResolve={(ok) => (ok ? applyDecision(undefined) : setDecision(null))}
          />
        ) : (
          <ConfirmDialog
            mode="prompt"
            title="Từ chối bài viết?"
            body={`Bài viết "${decision.title}" sẽ không được đăng. Người viết sẽ thấy lý do của bạn.`}
            confirmLabel="Từ chối"
            destructive
            multiline
            defaultValue="Nội dung chưa phù hợp tiêu chuẩn cộng đồng"
            onResolve={(ok, value) =>
              ok
                ? applyDecision(value.trim() || "Nội dung chưa phù hợp")
                : setDecision(null)
            }
          />
        )
      ) : null}
    </div>
  );
}
