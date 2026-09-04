"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CaretLeft } from "@phosphor-icons/react/CaretLeft";

import { Container } from "@/components/ui/container";
import { Spinner } from "@/components/ui/spinner";
import { CommunityPostItem } from "@/components/app/community-post-card";
import { ErrorState } from "@/components/app/states";
import { ApiError } from "@/lib/api/client";
import { getCommunityPost } from "@/lib/api/community";
import type { CommunityPostResponse } from "@/lib/api/types";

export function CommunityPostDetailView({ postId }: { postId: number }) {
  const router = useRouter();
  const [post, setPost] = useState<CommunityPostResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  const loadPost = useCallback(
    (signal: AbortSignal) => getCommunityPost(postId, signal),
    [postId],
  );

  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    setError(null);
    loadPost(controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        setPost(data);
        setStatus("success");
      })
      .catch((e: unknown) => {
        if (controller.signal.aborted) return;
        setStatus("error");
        setError(e instanceof ApiError ? e.message : "Không tải được bài viết.");
      });
    return () => controller.abort();
  }, [loadPost, postId]);

  if (status === "loading") {
    return (
      <Container className="flex flex-col items-center gap-4 py-16">
        <Spinner size={32} label="Đang tải bài viết" />
      </Container>
    );
  }

  if (status === "error") {
    return (
      <Container className="flex flex-col gap-5 py-10">
        <ErrorState message={error ?? "Không tải được bài viết."} />
        <div>
          <button
            type="button"
            onClick={() => router.push("/community")}
            className="inline-flex items-center gap-1 text-sm font-medium text-accent-text underline underline-offset-4"
          >
            <CaretLeft size={15} />
            Về trang cộng đồng
          </button>
        </div>
      </Container>
    );
  }

  if (!post) return null;

  return (
    <Container className="flex flex-col gap-5 py-8">
      <div>
        <Link
          href="/community"
          className="inline-flex items-center gap-1 text-sm font-medium text-muted transition-colors hover:text-ink"
        >
          <CaretLeft size={15} />
          Cộng đồng
        </Link>
      </div>

      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
        {/* defaultCommentsOpen: the thread is the point of this page */}
        <CommunityPostItem post={post} defaultCommentsOpen onDeleted={() => router.push("/community")} />
      </div>
    </Container>
  );
}