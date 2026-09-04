"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Cards } from "@phosphor-icons/react/Cards";
import { ChatCircleDots } from "@phosphor-icons/react/ChatCircleDots";
import { Heart } from "@phosphor-icons/react/Heart";
import { HeartStraight } from "@phosphor-icons/react/HeartStraight";
import { ShareFat } from "@phosphor-icons/react/ShareFat";
import { Trash } from "@phosphor-icons/react/Trash";

import { Button } from "@/components/ui/button";
import { RowSkeleton } from "@/components/app/states";
import {
  createComment,
  deleteComment,
  deleteCommunityPost,
  listCommentReplies,
  listPostComments,
  togglePostLike,
} from "@/lib/api/community";
import { useSession } from "@/lib/auth/use-session";
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
  const [liked, setLiked] = useState(post.likedByCurrentUser);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [commentCount, setCommentCount] = useState(post.commentCount);
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
        setLiked(result.liked);
        setLikeCount(result.likeCount);
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
          onCountChanged={(delta) => setCommentCount((c) => Math.max(0, c + delta))}
        />
      ) : null}
    </article>
  );
}

/* -------------------------- inline comments -------------------------- */

function PostComments({
  postId,
  onCountChanged,
}: {
  postId: number;
  onCountChanged: (delta: number) => void;
}) {
  const session = useSession();
  const me = session?.user;
  const [comments, setComments] = useState<CommentResponse[] | null>(null);
  const [error, setError] = useState(false);
  const [draft, setDraft] = useState("");
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

  function submit() {
    if (!draft.trim() || pending) return;
    setPending(true);
    createComment(postId, { content: draft.trim() })
      .then(() => {
        setDraft("");
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
              onRemoved={() => {
                onCountChanged(-1);
                setNonce((n) => n + 1);
              }}
            />
          ))}
        </ul>
      ) : null}

      <div className="flex items-center gap-2.5">
        <Avatar
          name={me?.fullName?.trim() || me?.email || "Bạn"}
          src={me?.avatar}
          className="h-8 w-8"
        />
        <textarea
          rows={1}
          value={draft}
          placeholder="Viết bình luận..."
          onChange={(e) => setDraft(e.target.value)}
          disabled={pending}
          aria-label="Viết bình luận"
          className="max-h-28 flex-1 resize-y rounded-full border border-line bg-surface-2 px-4 py-2 text-sm text-ink placeholder:text-muted transition-colors hover:border-ink/25 focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-60"
        />
        <Button onClick={submit} disabled={pending || !draft.trim()} className="h-9 px-4">
          {pending ? "..." : "Gửi"}
        </Button>
      </div>
    </div>
  );
}

function CommentRow({
  comment,
  onRemoved,
}: {
  comment: CommentResponse;
  onRemoved: () => void;
}) {
  const session = useSession();
  const own = session?.user.id === comment.profileId;
  const [replies, setReplies] = useState<CommentResponse[] | null>(null);
  const [repliesOpen, setRepliesOpen] = useState(false);
  const [replyDraft, setReplyDraft] = useState("");
  const [pending, setPending] = useState(false);

  function loadReplies() {
    setRepliesOpen((v) => !v);
    if (replies) return;
    listCommentReplies(comment.id)
      .then((res) => setReplies(res.content))
      .catch(() => setReplies([]));
  }

  function submitReply() {
    if (!replyDraft.trim() || pending) return;
    setPending(true);
    createComment(comment.communityPostId, {
      content: replyDraft.trim(),
      parentCommentId: comment.id,
    })
      .then(() => listCommentReplies(comment.id))
      .then((res) => {
        setReplies(res.content);
        setReplyDraft("");
        setPending(false);
      })
      .catch(() => setPending(false));
  }

  function remove() {
    if (!window.confirm("Xoá bình luận này?")) return;
    deleteComment(comment.id)
      .then(onRemoved)
      .catch(() => undefined);
  }

  return (
    <li className="flex gap-2.5">
      <Avatar name={comment.profileName} src={comment.profileAvatar} className="h-8 w-8" />
      <div className="min-w-0 flex-1">
        <div className="w-fit max-w-full rounded-field bg-surface-2 px-3.5 py-2.5">
          <p className="text-xs font-semibold text-ink">{comment.profileName}</p>
          <p className="whitespace-pre-line text-sm leading-relaxed text-ink/90">
            {comment.content}
          </p>
        </div>
        <div className="mt-1 flex items-center gap-3 pl-1 text-xs text-muted">
          <span>{formatDay(comment.createdAt)}</span>
          <button
            type="button"
            onClick={() => setRepliesOpen((v) => !v)}
            className="font-medium transition-colors hover:text-ink"
          >
            Trả lời
          </button>
          {comment.replyCount > 0 && !repliesOpen ? (
            <button
              type="button"
              onClick={loadReplies}
              className="font-medium transition-colors hover:text-ink"
            >
              {comment.replyCount} trả lời
            </button>
          ) : null}
          {own ? (
            <button
              type="button"
              onClick={remove}
              className="transition-colors hover:text-danger"
            >
              Xoá
            </button>
          ) : null}
        </div>

        {repliesOpen ? (
          <div className="mt-2 flex flex-col gap-2">
            {replies === null ? (
              <p className="pl-1 text-xs text-muted">Đang tải trả lời...</p>
            ) : (
              replies.map((reply) => <ReplyBubble key={reply.id} reply={reply} />)
            )}
            <div className="flex items-center gap-2">
              <textarea
                rows={1}
                value={replyDraft}
                placeholder="Trả lời..."
                onChange={(e) => setReplyDraft(e.target.value)}
                disabled={pending}
                aria-label="Trả lời bình luận"
                className="flex-1 resize-none rounded-full border border-line bg-surface-2 px-3.5 py-1.5 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-60"
              />
              <Button
                onClick={submitReply}
                disabled={pending || !replyDraft.trim()}
                className="h-8 px-3 text-xs"
              >
                {pending ? "..." : "Gửi"}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </li>
  );
}

function ReplyBubble({ reply }: { reply: CommentResponse }) {
  return (
    <div className="flex gap-2">
      <Avatar name={reply.profileName} src={reply.profileAvatar} className="h-6 w-6" />
      <div className="w-fit max-w-full rounded-field bg-surface-2 px-3 py-2">
        <p className="text-xs font-semibold text-ink">{reply.profileName}</p>
        <p className="whitespace-pre-line text-sm leading-relaxed text-ink/90">
          {reply.content}
        </p>
      </div>
    </div>
  );
}