import { apiFetch } from "@/lib/api/client";
import type {
  CommentCreateRequest,
  CommentResponse,
  CommunityPostResponse,
  CommunityPostWriteRequest,
  PageResponse,
  PostLikeToggleResponse,
} from "@/lib/api/types";

/*
  Member side of community posts.

  The endpoints speak plain page/size query params (0-based, same convention
  the admin pending list uses) and return the shared Spring page wrapper.

  Writes answer 201-with-body in an HTTP 200 envelope; reads are plain. All
  routes require an authenticated session: there is no anonymous read here,
  unlike /decks/public.
*/

/** Most recently approved posts. */
export function listLatestCommunityPosts(page = 0, size = 20, signal?: AbortSignal) {
  return apiFetch<PageResponse<CommunityPostResponse>>(
    `/community-posts/latest?page=${page}&size=${size}`,
    { auth: true, signal },
  );
}

/** Posts ranked by like count. */
export function listPopularCommunityPosts(page = 0, size = 20, signal?: AbortSignal) {
  return apiFetch<PageResponse<CommunityPostResponse>>(
    `/community-posts/popular?page=${page}&size=${size}`,
    { auth: true, signal },
  );
}

/**
 * Keyword and tagId are individually optional but the endpoint 400s when both
 * are absent (verified in the guide), so callers must always send one.
 */
export function searchCommunityPosts(
  params: { keyword?: string; tagId?: number },
  page = 0,
  size = 20,
  signal?: AbortSignal,
) {
  const qs = new URLSearchParams({ page: String(page), size: String(size) });
  if (params.keyword?.trim()) qs.set("keyword", params.keyword.trim());
  if (params.tagId !== undefined) qs.set("tagId", String(params.tagId));
  return apiFetch<PageResponse<CommunityPostResponse>>(
    `/community-posts/search?${qs.toString()}`,
    { auth: true, signal },
  );
}

/** Posts the signed-in profile has written, any status, newest first. */
export function listMyCommunityPosts(page = 0, size = 20, signal?: AbortSignal) {
  return apiFetch<PageResponse<CommunityPostResponse>>(
    `/community-posts/my-posts?page=${page}&size=${size}`,
    { auth: true, signal },
  );
}

/** Another member's posts by profile id. */
export function listPostsByProfile(
  profileId: string,
  page = 0,
  size = 20,
  signal?: AbortSignal,
) {
  return apiFetch<PageResponse<CommunityPostResponse>>(
    `/community-posts/user/${profileId}?page=${page}&size=${size}`,
    { auth: true, signal },
  );
}

export function getCommunityPost(postId: number, signal?: AbortSignal) {
  return apiFetch<CommunityPostResponse>(`/community-posts/${postId}`, {
    auth: true,
    signal,
  });
}

/**
 * Create a post. New posts start PENDING; they only appear publicly after an
 * admin approves them, so the UI must say that instead of promising a listing.
 */
export function createCommunityPost(body: CommunityPostWriteRequest) {
  return apiFetch<CommunityPostResponse>("/community-posts", {
    method: "POST",
    body,
    auth: true,
  });
}

export function updateCommunityPost(
  postId: number,
  body: CommunityPostWriteRequest,
) {
  return apiFetch<CommunityPostResponse>(`/community-posts/${postId}`, {
    method: "PUT",
    body,
    auth: true,
  });
}

export function deleteCommunityPost(postId: number) {
  return apiFetch<void>(`/community-posts/${postId}`, {
    method: "DELETE",
    auth: true,
  });
}

/** Toggle. The response carries the new state; never patch local state twice. */
export function togglePostLike(postId: number) {
  return apiFetch<PostLikeToggleResponse>(`/community-posts/${postId}/like`, {
    method: "POST",
    auth: true,
  });
}

export function listPostComments(
  postId: number,
  page = 0,
  size = 50,
  signal?: AbortSignal,
) {
  return apiFetch<PageResponse<CommentResponse>>(
    `/community-posts/${postId}/comments?page=${page}&size=${size}`,
    { auth: true, signal },
  );
}

export function createComment(postId: number, body: CommentCreateRequest) {
  return apiFetch<CommentResponse>(`/community-posts/${postId}/comments`, {
    method: "POST",
    body,
    auth: true,
  });
}

export function deleteComment(commentId: number) {
  return apiFetch<void>(`/community-posts/comments/${commentId}`, {
    method: "DELETE",
    auth: true,
  });
}

export function listCommentReplies(
  commentId: number,
  page = 0,
  size = 20,
  signal?: AbortSignal,
) {
  return apiFetch<PageResponse<CommentResponse>>(
    `/community-posts/comments/${commentId}/replies?page=${page}&size=${size}`,
    { auth: true, signal },
  );
}