"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MagnifyingGlass } from "@phosphor-icons/react/MagnifyingGlass";
import { CaretLeft } from "@phosphor-icons/react/CaretLeft";
import { CaretRight } from "@phosphor-icons/react/CaretRight";
import { PencilSimpleLine } from "@phosphor-icons/react/PencilSimpleLine";
import { ImagesSquare } from "@phosphor-icons/react/ImagesSquare";
import { ListChecks } from "@phosphor-icons/react/ListChecks";

import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { TextInput } from "@/components/ui/field";
import { SelectDropdown } from "@/components/ui/select-dropdown";
import { Spinner } from "@/components/ui/spinner";
import {
  Avatar,
  CommunityPostItem,
} from "@/components/app/community-post-card";
import { EmptyState, ErrorState, RowSkeleton } from "@/components/app/states";
import { ApiError } from "@/lib/api/client";
import {
  createCommunityPost,
  listLatestCommunityPosts,
  listMyCommunityPosts,
  listPopularCommunityPosts,
  searchCommunityPosts,
} from "@/lib/api/community";
import { listTags } from "@/lib/api/tags";
import { listMyDecks } from "@/lib/api/decks";
import { useSession } from "@/lib/auth/use-session";
import type { CommunityPostResponse, TagResponse } from "@/lib/api/types";

type Tab = "latest" | "popular" | "my-posts";
type Mode = "browse" | "search";

const PAGE_SIZE = 10;

export function CommunityView() {
  const session = useSession();
  const me = session?.user;
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("latest");
  const [mode, setMode] = useState<Mode>("browse");
  const [keywordInput, setKeywordInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [tagId, setTagId] = useState<string>("");
  const [page, setPage] = useState(0);
  const [composerOpen, setComposerOpen] = useState(false);
  const [decks, setDecks] = useState<{ id: number; title: string }[]>([]);
  const [tags, setTags] = useState<TagResponse[]>([]);

  const searching = mode === "search";

  const load = useCallback(
    (signal: AbortSignal) => {
      if (searching) {
        const numericTagId = tagId ? Number(tagId) : undefined;
        if (!keyword.trim() && numericTagId === undefined) {
          return Promise.resolve({
            content: [] as CommunityPostResponse[],
            pageNo: 0,
            pageSize: PAGE_SIZE,
            totalElements: 0,
            totalPages: 0,
            last: true,
          });
        }
        return searchCommunityPosts(
          { keyword: keyword.trim() || undefined, tagId: numericTagId },
          page,
          PAGE_SIZE,
          signal,
        );
      }
      if (tab === "popular") return listPopularCommunityPosts(page, PAGE_SIZE, signal);
      if (tab === "my-posts") return listMyCommunityPosts(page, PAGE_SIZE, signal);
      return listLatestCommunityPosts(page, PAGE_SIZE, signal);
    },
    [searching, keyword, tagId, tab, page],
  );

  const [posts, setPosts] = useState<CommunityPostResponse[]>([]);
  const [lastPage, setLastPage] = useState(true);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    setError(null);
    load(controller.signal)
      .then((res) => {
        if (controller.signal.aborted) return;
        setPosts(res.content);
        setLastPage(res.last);
        setTotal(res.totalElements);
        setStatus("success");
      })
      .catch((e: unknown) => {
        if (controller.signal.aborted) return;
        setStatus("error");
        setError(
          e instanceof ApiError ? e.message : "Something went wrong loading posts.",
        );
      });
    return () => controller.abort();
  }, [load, reloadNonce]);

  // Composer needs the member's decks and the tag catalogue; the sidebar list
  // of my decks reads the same state, so both load on mount.
  useEffect(() => {
    if (!composerOpen && decks.length > 0) return;
    const controller = new AbortController();
    listMyDecks(1, 100, controller.signal)
      .then((res) => {
        if (!controller.signal.aborted) setDecks(res.content);
      })
      .catch(() => undefined);
    if (!composerOpen) return () => controller.abort();
    listTags(controller.signal)
      .then((res) => {
        if (!controller.signal.aborted) setTags(res);
      })
      .catch(() => undefined);
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [composerOpen]);

  function submitSearch() {
    setMode("search");
    setPage(0);
    setKeyword(keywordInput);
    setReloadNonce((n) => n + 1);
  }

  function backToBrowse() {
    setMode("browse");
    setKeyword("");
    setKeywordInput("");
    setTagId("");
    setPage(0);
  }

  function onCreated() {
    setComposerOpen(false);
    setMode("browse");
    setTab("my-posts");
    setPage(0);
    setReloadNonce((n) => n + 1);
    router.refresh();
  }

  return (
    <Container className="flex flex-col gap-6 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">Cộng đồng</h1>
        <p className="text-sm text-muted">
          Chia sẻ cách học và bộ thẻ của bạn. Bài mới sẽ hiện sau khi được duyệt.
        </p>
      </header>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {searching ? (
          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={backToBrowse} className="shrink-0">
              <CaretLeft size={15} />
              Tất cả
            </Button>
            <p className="truncate text-sm text-muted">
              Kết quả cho{" "}
              <span className="font-medium text-ink">
                {keyword || "tag đã chọn"}
              </span>
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-1 rounded-full border border-line bg-surface p-1 self-start">
            {(
              [
                { key: "latest", label: "Mới nhất" },
                { key: "popular", label: "Phổ biến" },
                { key: "my-posts", label: "Bài của tôi" },
              ] as const
            ).map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  setTab(item.key);
                  setPage(0);
                }}
                className={
                  tab === item.key
                    ? "rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-accent-fg shadow-sm"
                    : "rounded-full px-4 py-1.5 text-sm font-medium text-muted transition-colors hover:text-ink"
                }
              >
                {item.label}
              </button>
            ))}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitSearch();
          }}
          className="flex items-center gap-2"
        >
          <div className="relative flex items-center">
            <MagnifyingGlass
              size={15}
              className="pointer-events-none absolute left-3 text-muted"
            />
            <TextInput
              aria-label="Tìm bài viết"
              value={keywordInput}
              placeholder="Tìm trong cộng đồng..."
              onChange={(e) => setKeywordInput(e.target.value)}
              className="h-10 w-full pl-9 sm:w-60"
            />
          </div>
          <SelectDropdown
            id="community-tag-filter"
            value={tagId}
            options={[
              { value: "", label: "Mọi tag" },
              ...tags.map((t) => ({ value: String(t.id), label: t.name })),
            ]}
            onValueChange={(v) => {
              setTagId(v);
              if (v) {
                setMode("search");
                setKeyword(keywordInput);
                setPage(0);
              }
            }}
            className="h-10 w-40"
          />
          <Button type="submit" variant="secondary" className="h-10 px-3" aria-label="Tìm">
            <MagnifyingGlass size={16} />
          </Button>
        </form>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        {/* Feed column */}
        <div className="flex min-w-0 flex-col gap-4">
          {/* Composer trigger, Facebook style */}
          {me ? (
            <button
              type="button"
              onClick={() => setComposerOpen(true)}
              className="flex items-center gap-3 rounded-card border border-line bg-surface p-4 text-left"
            >
              <Avatar
                name={me.fullName?.trim() || me.email}
                src={me.avatar}
                className="h-10 w-10"
              />
              <span className="flex-1 rounded-full bg-surface-2 px-4 py-2 text-sm text-muted transition-colors hover:bg-accent-soft hover:text-ink">
                Bạn đang nghĩ gì?
              </span>
            </button>
          ) : null}

          {error ? (
            <ErrorState
              message={error}
              onRetry={() => setReloadNonce((n) => n + 1)}
            />
          ) : null}
          {status === "loading" ? (
            <div className="flex flex-col gap-4">
              <Spinner className="self-center" size={28} label="Đang tải bài viết" />
              <RowSkeleton count={3} />
            </div>
          ) : null}

          {status === "success" && posts.length === 0 ? (
            <EmptyState
              title={searching ? "Không có bài nào khớp" : "Chưa có bài viết nào"}
              body={
                searching
                  ? "Thử từ khóa khác hoặc bỏ chọn tag."
                  : "Hãy là người đầu tiên chia sẻ bài viết cho cộng đồng."
              }
              action={
                <Button variant="secondary" onClick={() => setComposerOpen(true)}>
                  <PencilSimpleLine size={16} />
                  Viết bài
                </Button>
              }
            />
          ) : null}

          {status === "success" && posts.length > 0 ? (
            <>
              {posts.map((post) => (
                <CommunityPostItem key={post.id} post={post} />
              ))}

              {/* Pager, hidden while everything fits on one page */}
              {lastPage && page === 0 ? null : (
                <div className="flex items-center justify-between text-sm text-muted">
                  <span>
                    Trang {page + 1}
                    {total > 0 ? ` · ${total.toLocaleString("vi-VN")} bài` : ""}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                      disabled={page === 0}
                      aria-label="Trang trước"
                      className="h-9 w-9 p-0"
                    >
                      <CaretLeft size={15} />
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => setPage((p) => p + 1)}
                      disabled={lastPage}
                      aria-label="Trang sau"
                      className="h-9 w-9 p-0"
                    >
                      <CaretRight size={15} />
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Sidebar */}
        <aside className="flex flex-col gap-4 self-start lg:sticky lg:top-24">
          <div className="flex flex-col gap-3 rounded-card border border-line bg-surface p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
              <ImagesSquare size={16} className="text-accent" />
              Bộ thẻ của bạn
            </h2>
            {decks.length === 0 ? (
              <p className="text-sm text-muted">
                Chưa có bộ thẻ. Tạo bộ thẻ để gắn vào bài viết.
              </p>
            ) : (
              <ul className="flex flex-col gap-1.5 text-sm">
                {decks.slice(0, 5).map((deck) => (
                  <li key={deck.id}>
                    <Link
                      href={`/decks/${deck.id}`}
                      className="block truncate rounded-field px-2 py-1 text-muted transition-colors hover:bg-surface-2 hover:text-ink"
                    >
                      {deck.title}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-col gap-3 rounded-card border border-line bg-surface p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
              <ListChecks size={16} className="text-accent" />
              Quy tắc ngắn gọn
            </h2>
            <ul className="flex flex-col gap-1.5 text-sm text-muted">
              <li>Bài viết được quản trị viên duyệt trước khi công khai.</li>
              <li>Gắn bộ thẻ để người khác học theo được.</li>
              <li>Bình luận tử tế, không quảng cáo.</li>
            </ul>
          </div>
        </aside>
      </div>

      {composerOpen ? (
        <PostComposer
          decks={decks}
          tags={tags}
          onClose={() => setComposerOpen(false)}
          onCreated={onCreated}
        />
      ) : null}
    </Container>
  );
}

/* ------------------------------- composer ------------------------------- */

const MAX_TAGS = 5;

function PostComposer({
  decks,
  tags,
  onClose,
  onCreated,
}: {
  decks: { id: number; title: string }[];
  tags: TagResponse[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [deckId, setDeckId] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleTag(id: number) {
    setSelectedTagIds((prev) =>
      prev.includes(id)
        ? prev.filter((t) => t !== id)
        : prev.length >= MAX_TAGS
          ? prev
          : [...prev, id],
    );
  }

  function submit() {
    if (!title.trim() || !content.trim() || pending) return;
    setPending(true);
    setError(null);
    createCommunityPost({
      title: title.trim(),
      content: content.trim(),
      deckId: deckId ? Number(deckId) : undefined,
      tagIds: selectedTagIds.length > 0 ? selectedTagIds : undefined,
    })
      .then(() => onCreated())
      .catch((e: unknown) => {
        setPending(false);
        setError(e instanceof ApiError ? e.message : "Không tạo được bài viết.");
      });
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Viết bài mới"
    >
      <div className="mt-10 w-full max-w-2xl rounded-card border border-line bg-paper p-6 shadow-xl">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold tracking-tight">Viết bài mới</h2>
          <Button variant="secondary" onClick={onClose} className="h-9 px-3">
            Đóng
          </Button>
        </div>

        <div className="mt-5 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="post-title" className="text-sm font-medium text-ink">
              Tiêu đề
            </label>
            <TextInput
              id="post-title"
              value={title}
              maxLength={120}
              placeholder="Ví dụ: Mẹo nhớ 50 từ tiếng Nhật mỗi tuần"
              onChange={(e) => setTitle(e.target.value)}
              disabled={pending}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="post-content" className="text-sm font-medium text-ink">
              Nội dung
            </label>
            <textarea
              id="post-content"
              rows={7}
              value={content}
              placeholder="Chia sẻ cách học, trải nghiệm hoặc câu chuyện của bạn..."
              onChange={(e) => setContent(e.target.value)}
              disabled={pending}
              className="w-full rounded-field border border-line bg-surface px-3.5 py-2.5 text-base text-ink placeholder:text-muted transition-colors hover:border-ink/25 focus:outline-none focus:ring-2 focus:ring-accent disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-ink">
              Gắn bộ thẻ <span className="font-normal text-muted">(không bắt buộc)</span>
            </span>
            {decks.length === 0 ? (
              <p className="text-sm text-muted">Bạn chưa có bộ thẻ nào.</p>
            ) : (
              <SelectDropdown
                id="post-deck"
                value={deckId}
                options={[
                  { value: "", label: "Không gắn bộ thẻ" },
                  ...decks.map((d) => ({ value: String(d.id), label: d.title })),
                ]}
                onValueChange={(v) => setDeckId(v)}
                disabled={pending}
              />
            )}
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-ink">
              Tag <span className="font-normal text-muted">(tối đa {MAX_TAGS})</span>
            </span>
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag) => {
                const active = selectedTagIds.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag.id)}
                    disabled={pending}
                    aria-pressed={active}
                    className={
                      active
                        ? "rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-fg"
                        : "rounded-full border border-line bg-surface px-3 py-1 text-xs text-muted transition-colors hover:border-ink/25 hover:text-ink"
                    }
                  >
                    {tag.name}
                  </button>
                );
              })}
              {tags.length === 0 ? (
                <p className="text-sm text-muted">Chưa có tag nào.</p>
              ) : null}
            </div>
          </div>

          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={onClose} disabled={pending}>
              Huỷ
            </Button>
            <Button
              onClick={submit}
              disabled={pending || !title.trim() || !content.trim()}
            >
              {pending ? "Đang đăng..." : "Đăng bài"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}