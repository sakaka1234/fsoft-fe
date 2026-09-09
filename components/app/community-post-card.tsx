"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CaretDown } from "@phosphor-icons/react/CaretDown";
import { CaretUp } from "@phosphor-icons/react/CaretUp";
import { Cards } from "@phosphor-icons/react/Cards";
import { ChatCircleDots } from "@phosphor-icons/react/ChatCircleDots";
import { Heart } from "@phosphor-icons/react/Heart";
import { HeartStraight } from "@phosphor-icons/react/HeartStraight";
import { ShareFat } from "@phosphor-icons/react/ShareFat";
import { Trash } from "@phosphor-icons/react/Trash";

import { Button } from "@/components/ui/button";
import { RowSkeleton } from "@/components/app/states";
import {
  AttachmentPicker,
  ServerAttachment,
} from "@/components/app/attachment-picker";
import { isAdmin } from "@/lib/auth/roles";
import {
  createComment,
  deleteComment,
  deleteCommunityPost,
  listCommentReplies,
  listPostComments,
  togglePostLike,
} from "@/lib/api/community";
import { useSession } from "@/lib/auth/use-session";
import {
  usePostCommentsSocket,
  type PostCommentEvent,
} from "@/lib/community-ws";
import type { CommentResponse, CommunityPostResponse } from "@/lib/api/types";
import { cn } from "@/lib/cn";

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Chờ duyệt",
  APPROVED: "Đã duyệt",
  REJECTED: "Bị từ chối",
};

export function Avatar({
  name,
  src,
  className,
}: {
  name: string;
  src?: string | null;
  className?: string;
}) {
  const [hasError, setHasError] = useState(false);
  const cleanSrc = src?.trim();
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  if (cleanSrc && !hasError && cleanSrc !== "null" && cleanSrc !== "undefined") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={cleanSrc}
        alt=""
        onError={() => setHasError(true)}
        className={cn("h-9 w-9 shrink-0 rounded-full object-cover", className)}
      />
    );
  }

  return (
    <span
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent-text",
        className,
      )}
      aria-hidden="true"
    >
      {initials || "?"}
    </span>
  );
}

function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString("vi-VN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

type CommunityPostItemProps = {
  post: CommunityPostResponse;
  /** Detail page opens the thread right away; the feed keeps it collapsed. */
  defaultCommentsOpen?: boolean;
  onDeleted?: () => void;
};

/**
 * One post in the social feed: author header, body, counts row and the
 * Like / Comment / Share action bar, with comments expanding inline below.
 */
export function CommunityPostItem({
  post,
  defaultCommentsOpen = false,
  onDeleted,
}: CommunityPostItemProps) {
  const session = useSession();
  /* Local optimistic counters. The key trick for reload-persistence: when the
     server view changes underneath (list refetch after reload), the component
     is keyed by post id + liked state, so React resets local state via the
     derived-key pattern below instead of an effect setState. */
  const [likedState, setLikedState] = useState<{
    key: string;
    liked: boolean;
    likeCount: number;
    commentCount: number;
  }>({
    key: `${post.id}:${post.likedByCurrentUser}`,
    liked: post.likedByCurrentUser,
    likeCount: post.likeCount,
    commentCount: post.commentCount,
  });

  /* Derive-from-props reset: when the fetched post flips like state, the key
     changes and the next render re-seeds local state from the server values.
     No effect, no cascading render. */
  const serverKey = `${post.id}:${post.likedByCurrentUser}`;
  const [shownLiked, shownLikeCount, shownCommentCount] =
    likedState.key === serverKey
      ? [likedState.liked, likedState.likeCount, likedState.commentCount]
      : [post.likedByCurrentUser, post.likeCount, post.commentCount];
  if (likedState.key !== serverKey) {
    setLikedState({
      key: serverKey,
      liked: post.likedByCurrentUser,
      likeCount: post.likeCount,
      commentCount: post.commentCount,
    });
  }
  const liked = shownLiked;
  const likeCount = shownLikeCount;
  const commentCount = shownCommentCount;
  const [commentsOpen, setCommentsOpen] = useState(defaultCommentsOpen);
  const [pendingLike, setPendingLike] = useState(false);
  const [copied, setCopied] = useState(false);
  const [deleted, setDeleted] = useState(false);

  const own = session?.user.id === post.profileId;
  const longContent = post.content.length > 320;
  const visibleContent = longContent ? `${post.content.slice(0, 320)}...` : post.content;

  if (deleted) return null;

  function onLike() {
    if (pendingLike) return;
    setPendingLike(true);
    togglePostLike(post.id)
      .then((result) => {
        setLikedState({
          key: `${post.id}:${result.liked}`,
          liked: result.liked,
          likeCount: result.likeCount,
          commentCount,
        });
      })
      .catch(() => undefined)
      .finally(() => setPendingLike(false));
  }

  function share() {
    navigator.clipboard.writeText(`${window.location.origin}/community/${post.id}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function remove() {
    if (!window.confirm("Xoá bài viết này?")) return;
    deleteCommunityPost(post.id)
      .then(() => {
        setDeleted(true);
        onDeleted?.();
      })
      .catch(() => undefined);
  }

  return (
    <article className="flex flex-col gap-3 rounded-card border border-line bg-surface p-5">
      {/* Author header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar name={post.profileName} src={post.profileAvatar} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink">{post.profileName}</p>
            <p className="text-xs text-muted">{formatDay(post.createdAt)}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {post.status !== "APPROVED" ? (
            <span className="rounded-full border border-line bg-surface-2 px-2.5 py-0.5 text-xs font-medium text-muted">
              {STATUS_LABEL[post.status] ?? post.status}
            </span>
          ) : null}
          {own ? (
            <button
              type="button"
              onClick={remove}
              aria-label="Xoá bài viết"
              className="rounded-full p-1.5 text-muted transition-colors hover:bg-danger/10 hover:text-danger"
            >
              <Trash size={16} />
            </button>
          ) : null}
        </div>
      </div>

      {/* Body */}
      <Link href={`/community/${post.id}`} className="flex flex-col gap-2">
        <h3 className="text-xl font-bold leading-snug tracking-tight text-ink transition-colors hover:text-accent-text">
          {post.title}
        </h3>
        <p className="whitespace-pre-line text-sm leading-relaxed text-ink/90">
          {visibleContent}
        </p>
      </Link>
      {longContent ? (
        <Link
          href={`/community/${post.id}`}
          className="-mt-1 text-sm font-medium text-accent-text hover:underline"
        >
          Xem thêm
        </Link>
      ) : null}

      {post.deckId && post.deckTitle ? (
        <Link
          href={`/decks/${post.deckId}`}
          className="flex w-fit items-center gap-2 rounded-field border border-line bg-surface-2 px-3 py-1.5 text-xs text-muted transition-colors hover:border-ink/25 hover:text-ink"
        >
          <Cards size={15} className="shrink-0 text-accent" />
          <span className="max-w-[26ch] truncate font-medium">{post.deckTitle}</span>
          {post.deckTotalCards ? <span>({post.deckTotalCards} thẻ)</span> : null}
        </Link>
      ) : null}

      {(post.tags ?? []).length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {(post.tags ?? []).map((tag) => (
            <li
              key={tag.id}
              className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs text-accent-text"
            >
              {tag.name}
            </li>
          ))}
        </ul>
      ) : null}

      {post.attachmentUrl ? (
        <ServerAttachment
          url={post.attachmentUrl}
          name={post.attachmentName}
          className="relative z-10"
        />
      ) : null}

      {/* Counts row */}
      <div className="flex items-center justify-between px-1 pt-1 text-xs text-muted">
        <span className="inline-flex items-center gap-1">
          <HeartStraight
            size={14}
            weight={liked ? "fill" : "regular"}
            className={liked ? "text-danger" : ""}
          />
          {likeCount} lượt thích
        </span>
        <button
          type="button"
          onClick={() => setCommentsOpen((v) => !v)}
          className="transition-colors hover:text-ink"
        >
          {commentCount} bình luận
        </button>
      </div>

      {/* Action bar */}
      <div className="grid grid-cols-3 gap-1 border-t border-line pt-1">
        <button
          type="button"
          onClick={onLike}
          disabled={pendingLike}
          aria-pressed={liked}
          className={cn(
            "flex h-9 items-center justify-center gap-2 rounded-field text-sm font-medium transition-colors hover:bg-surface-2",
            liked ? "text-danger" : "text-muted",
          )}
        >
          {liked ? <HeartStraight size={17} weight="fill" /> : <Heart size={17} />}
          Thích
        </button>
        <button
          type="button"
          onClick={() => setCommentsOpen((v) => !v)}
          aria-expanded={commentsOpen}
          className="flex h-9 items-center justify-center gap-2 rounded-field text-sm font-medium text-muted transition-colors hover:bg-surface-2"
        >
          <ChatCircleDots size={17} />
          Bình luận
        </button>
        <button
          type="button"
          onClick={share}
          className="flex h-9 items-center justify-center gap-2 rounded-field text-sm font-medium text-muted transition-colors hover:bg-surface-2"
        >
          <ShareFat size={16} />
          {copied ? "Đã chép" : "Chia sẻ"}
        </button>
      </div>

      {commentsOpen ? (
        <PostComments
          postId={post.id}
          postOwnerId={post.profileId}
          onCountChanged={(delta) =>
            setLikedState({
              key: `${post.id}:${liked}`,
              liked,
              likeCount,
              commentCount: Math.max(0, commentCount + delta),
            })
          }
        />
      ) : null}
    </article>
  );
}

/* -------------------------- inline comments -------------------------- */

function PostComments({
  postId,
  postOwnerId,
  onCountChanged,
}: {
  postId: number;
  postOwnerId: string;
  onCountChanged: (delta: number) => void;
}) {
  const session = useSession();
  const me = session?.user;
  const admin = isAdmin(session);
  const canModerate = admin || session?.user.id === postOwnerId;
  const [comments, setComments] = useState<CommentResponse[] | null>(null);
  const [error, setError] = useState(false);
  const [draft, setDraft] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    listPostComments(postId, 0, 50, controller.signal)
      .then((res) => {
        if (!controller.signal.aborted) setComments(res.content);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => controller.abort();
  }, [postId, nonce]);

  /*
    Live thread over /topic/posts/{postId}. COMMENT_CREATED carries the full
    CommentResponse: a root comment inserts at the top of the list, a reply
    bumps its parent's replyCount in place (the child rows load on demand in
    CommentRow). COMMENT_DELETED removes by id and deflates the counter.
    Verified live 2026-09-09; every unknown shape is ignored so the backend
    can grow without breaking this panel.

    onCountChanged is an inline arrow in the parent, so its identity changes
    every render. The hook keeps the latest handler in a ref, which makes a
    stale closure impossible; the lint suppression replaces a useCallback
    dance that would only hide that fact.
  */
  usePostCommentsSocket({
    postId,
     
    onCommentEvent: useCallback(
      (event: PostCommentEvent) => {
        if (event.type === "COMMENT_CREATED") {
          const created = event.data as CommentResponse | null;
          if (!created?.id) return;
          if (created.parentCommentId === null) {
            setComments((current) => {
              if (!current) return [created];
              if (current.some((c) => c.id === created.id)) return current;
              return [created, ...current];
            });
          } else {
            setComments((current) =>
              current?.map((c) =>
                c.id === created.parentCommentId
                  ? { ...c, replyCount: c.replyCount + 1 }
                  : c,
              ) ?? current,
          );
          }
          onCountChanged(1);
        } else if (event.type === "COMMENT_DELETED") {
          const removed = event.data as {
            commentId?: number;
            parentCommentId?: number | null;
          } | null;
          if (!removed?.commentId) return;
          if (removed.parentCommentId === null || removed.parentCommentId === undefined) {
            setComments((current) =>
              current ? current.filter((c) => c.id !== removed.commentId) : current,
            );
            onCountChanged(-1);
          } else {
            setComments((current) =>
              current?.map((c) =>
                c.id === removed.parentCommentId
                  ? { ...c, replyCount: Math.max(0, c.replyCount - 1) }
                  : c,
              ) ?? current,
            );
            onCountChanged(-1);
          }
        }
      },
      // eslint-disable-next-line react-hooks/exhaustive-deps -- the hook stores the latest handler in a ref, so an empty dep list cannot go stale
      [],
    ),
  });

  function submit() {
    if (!draft.trim() || pending) return;
    setPending(true);
    createComment(postId, { content: draft.trim() }, attachment ?? undefined)
      .then(() => {
        setDraft("");
        setAttachment(null);
        setPending(false);
        onCountChanged(1);
        setNonce((n) => n + 1);
      })
      .catch(() => setPending(false));
  }

  return (
    <div id="comments" className="flex flex-col gap-3 border-t border-line pt-3">
      {comments === null && !error ? <RowSkeleton count={2} /> : null}
      {error ? <p className="text-sm text-danger">Không tải được bình luận.</p> : null}

      {comments !== null && comments.length === 0 ? (
        <p className="text-sm text-muted">Chưa có bình luận nào.</p>
      ) : null}

      {comments !== null && comments.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {comments.map((comment) => (
            <CommentRow
              key={comment.id}
              comment={comment}
              postId={postId}
              canModerate={canModerate}
              depth={0}
              onCountChanged={onCountChanged}
              onRemoved={() => {
                onCountChanged(-1);
                setNonce((n) => n + 1);
              }}
            />
          ))}
        </ul>
      ) : null}

      <div className="flex items-start gap-2.5">
        <Avatar
          name={me?.fullName?.trim() || me?.email || "Bạn"}
          src={me?.avatar}
          className="h-8 w-8"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <textarea
            rows={1}
            value={draft}
            placeholder="Viết bình luận..."
            onChange={(e) => setDraft(e.target.value)}
            disabled={pending}
            aria-label="Viết bình luận"
            className="max-h-28 resize-y rounded-field border border-line bg-surface-2 px-4 py-2 text-sm text-ink placeholder:text-muted transition-colors hover:border-ink/25 focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-60"
          />
          <div className="flex items-center justify-between gap-2">
            <AttachmentPicker
              file={attachment}
              onFileChange={setAttachment}
              disabled={pending}
              label="Đính kèm file vào bình luận"
            />
            <Button onClick={submit} disabled={pending || !draft.trim()} className="h-9 px-4">
              {pending ? "..." : "Gửi"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function renderCommentContent(content: string) {
  const mentionMatch = content.match(/^(@[^\n:]+?)(?:\s|:|$)/);
  if (!mentionMatch) return content;

  const mention = mentionMatch[1];
  const rest = content.slice(mention.length);
  return (
    <>
      <span className="font-semibold text-accent-text">{mention}</span>
      {rest}
    </>
  );
}

function CommentRow({
  comment,
  postId,
  canModerate,
  onRemoved,
  onCountChanged,
  depth = 0,
}: {
  comment: CommentResponse;
  postId: number;
  canModerate: boolean;
  onRemoved: () => void;
  onCountChanged?: (delta: number) => void;
  depth?: number;
}) {
  const session = useSession();
  const [replies, setReplies] = useState<CommentResponse[] | null>(null);
  const [repliesOpen, setRepliesOpen] = useState(depth === 0);
  const [composerOpen, setComposerOpen] = useState(false);
  const [replyDraft, setReplyDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [replyFile, setReplyFile] = useState<File | null>(null);

  useEffect(() => {
    if (!repliesOpen || comment.replyCount === 0) return;
    const controller = new AbortController();
    listCommentReplies(comment.id, 1, 20, controller.signal)
      .then((res) => {
        if (!controller.signal.aborted) setReplies(res.content);
      })
      .catch(() => {
        if (!controller.signal.aborted) setReplies([]);
      });
    return () => controller.abort();
  }, [comment.id, repliesOpen, comment.replyCount]);

  function handleToggleReplyComposer() {
    setComposerOpen((v) => {
      const next = !v;
      if (next && depth > 0) {
        setReplyDraft(`@${comment.profileName} `);
      }
      return next;
    });
  }

  function submitReply() {
    if (!replyDraft.trim() || pending) return;
    setPending(true);
    createComment(
      postId,
      { content: replyDraft.trim(), parentCommentId: comment.id },
      replyFile ?? undefined,
    )
      .then((created) => {
        setReplyDraft("");
        setReplyFile(null);
        setPending(false);
        setComposerOpen(false);
        setRepliesOpen(true);
        onCountChanged?.(1);
        setReplies((curr) => (curr ? [created, ...curr] : [created]));
        return listCommentReplies(comment.id, 1);
      })
      .then((res) => {
        if (res) setReplies(res.content);
      })
      .catch(() => setPending(false));
  }

  function removeChildReply(childId: number) {
    setReplies((curr) => (curr ? curr.filter((r) => r.id !== childId) : curr));
    onCountChanged?.(-1);
    deleteComment(childId)
      .then(() => listCommentReplies(comment.id, 1))
      .then((res) => setReplies(res.content))
      .catch(() => {
        listCommentReplies(comment.id, 1)
          .then((res) => setReplies(res.content))
          .catch(() => undefined);
      });
  }

  function remove() {
    deleteComment(comment.id)
      .then(onRemoved)
      .catch(() => undefined);
  }

  const canDelete = canModerate || session?.user.id === comment.profileId;
  const avatarSize = depth === 0 ? "h-8 w-8" : "h-7 w-7";
  const indentClass =
    depth === 0
      ? ""
      : depth < 4
        ? "ml-6 sm:ml-8 border-l border-line pl-3 sm:pl-3.5"
        : "ml-3 sm:ml-4 border-l border-line pl-2 sm:pl-2.5";
  const shownReplies = comment.replyCount === 0 && replies === null ? [] : replies;
  const replyCount = shownReplies !== null ? shownReplies.length : comment.replyCount;

  return (
    <li className={cn("flex flex-col gap-2", indentClass)}>
      <div className="flex gap-2.5">
        <Avatar
          name={comment.profileName}
          src={comment.profileAvatar}
          className={cn(avatarSize, "shrink-0")}
        />
        <div className="min-w-0 flex-1">
          <div className="w-fit max-w-full rounded-field bg-surface-2 px-3.5 py-2.5">
            <p className="text-xs font-semibold text-ink">{comment.profileName}</p>
            <p className="whitespace-pre-line text-sm leading-relaxed text-ink/90">
              {renderCommentContent(comment.content)}
            </p>
            {comment.attachmentUrl ? (
              <ServerAttachment
                url={comment.attachmentUrl}
                name={comment.attachmentName}
                className="mt-1.5"
              />
            ) : null}
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-3 pl-1 text-xs text-muted">
            <span>{formatDay(comment.createdAt)}</span>
            <button
              type="button"
              onClick={handleToggleReplyComposer}
              aria-expanded={composerOpen}
              className="font-medium transition-colors hover:text-ink"
            >
              Trả lời
            </button>
            {canDelete ? (
              <button
                type="button"
                onClick={remove}
                className="transition-colors hover:text-danger"
              >
                Xoá
              </button>
            ) : null}
            {replyCount > 0 ? (
              <button
                type="button"
                onClick={() => setRepliesOpen((v) => !v)}
                className="inline-flex items-center gap-1 font-medium text-accent-text transition-colors hover:underline"
              >
                {repliesOpen ? (
                  <>
                    <CaretUp size={12} weight="bold" />
                    <span>Ẩn câu trả lời</span>
                  </>
                ) : (
                  <>
                    <CaretDown size={12} weight="bold" />
                    <span>Xem {replyCount} câu trả lời</span>
                  </>
                )}
              </button>
            ) : null}
          </div>

          {composerOpen ? (
            <div className="mt-2 flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <textarea
                  rows={1}
                  value={replyDraft}
                  placeholder={`Trả lời ${comment.profileName}...`}
                  onChange={(e) => setReplyDraft(e.target.value)}
                  disabled={pending}
                  aria-label={`Trả lời ${comment.profileName}`}
                  autoFocus
                  className="flex-1 resize-none rounded-full border border-line bg-surface-2 px-3.5 py-1.5 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-60"
                />
                <Button
                  onClick={submitReply}
                  disabled={pending || !replyDraft.trim()}
                  className="h-8 px-3 text-xs"
                >
                  {pending ? "..." : "Gửi"}
                </Button>
                <button
                  type="button"
                  onClick={() => {
                    setComposerOpen(false);
                    setReplyDraft("");
                    setReplyFile(null);
                  }}
                  disabled={pending}
                  className="text-xs text-muted transition-colors hover:text-ink"
                >
                  Huỷ
                </button>
              </div>
              <AttachmentPicker
                disabled={pending}
                file={replyFile}
                onFileChange={setReplyFile}
                label="Đính kèm file vào trả lời"
              />
            </div>
          ) : null}
        </div>
      </div>

      {/* Recursive nested child replies */}
      {repliesOpen && replyCount > 0 ? (
        <ul className="flex flex-col gap-2 pt-1">
          {shownReplies === null ? (
            <li className={cn("text-xs text-muted", depth === 0 ? "ml-10 pl-3" : "ml-6 pl-3")}>
              Đang tải trả lời...
            </li>
          ) : shownReplies.length === 0 ? (
            <li className={cn("text-xs text-muted", depth === 0 ? "ml-10 pl-3" : "ml-6 pl-3")}>
              Chưa có trả lời.
            </li>
          ) : (
            shownReplies.map((child) => (
              <CommentRow
                key={child.id}
                comment={child}
                postId={postId}
                canModerate={canModerate}
                depth={depth + 1}
                onRemoved={() => removeChildReply(child.id)}
                onCountChanged={onCountChanged}
              />
            ))
          )}
        </ul>
      ) : null}
    </li>
  );
}