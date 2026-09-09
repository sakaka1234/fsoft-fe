"use client";

import { useEffect, useRef } from "react";
import { Client } from "@stomp/stompjs";

import { API_BASE_URL } from "@/lib/api/client";
import { getSession } from "@/lib/auth/session-store";

/*
  Live post updates over the same STOMP broker the community chat uses. The
  broker path and topic names follow /ws-chat + /topic/community from
  community-chat-widget.tsx; the community topics piggyback on that broker.

  Verified live 2026-09-09: like (and unlike) publish
  {"type":"LIKE_COUNT_CHANGED","postId":N,"data":{postId,liked,likeCount}}
  on /topic/community/feed. Comments publish on /topic/posts/{postId}, not
  the feed topic — see the comment hook in community-post-card.tsx.

  A closed socket or a failed handshake degrades to nothing: the feed still
  shows the data it loaded, and every write reloads its row, so real-time is
  a bonus rather than a dependency.
*/

export type CommunityFeedEventType =
  | "LIKE_COUNT_CHANGED"
  | "COMMENT_COUNT_CHANGED"
  | (string & {});

export type CommunityFeedEvent = {
  type: CommunityFeedEventType;
  postId: number;
  data: {
    postId: number;
    liked: boolean;
    likeCount: number;
  };
  timestamp: string;
};

/** Kept for the older flat shape; the live broker sends the envelope above. */
export type CommunityPostEvent = {
  /** The post whose state changed; the payload carries the fresh counters. */
  postId: number;
  likeCount?: number;
  commentCount?: number;
  likedByCurrentUser?: boolean;
};

type UseCommunityPostsSocketOptions = {
  enabled: boolean;
  /** Called with each event for the feed to patch its rows in place. */
  onPostEvent: (event: CommunityPostEvent) => void;
};

export function useCommunityPostsSocket({
  enabled,
  onPostEvent,
}: UseCommunityPostsSocketOptions) {
  /* Keep the latest callback without re-subscribing on every render. The
     assignment happens inside an effect rather than during render, which the
     compiler forbids. */
  const handlerRef = useRef(onPostEvent);
  const clientRef = useRef<Client | null>(null);

  useEffect(() => {
    handlerRef.current = onPostEvent;
  }, [onPostEvent]);

  useEffect(() => {
    if (!enabled || clientRef.current) return;

    const token = getSession()?.token.accessToken;
    const wsUrl = API_BASE_URL.replace(/^http/, "ws") + "/ws-chat";

    let client: Client;
    try {
      client = new Client({
        brokerURL: wsUrl,
        connectHeaders: token ? { Authorization: `Bearer ${token}` } : {},
        reconnectDelay: 5000,
        heartbeatIncoming: 4000,
        heartbeatOutgoing: 4000,
        onConnect: () => {
          client.subscribe("/topic/community/feed", (msg) => {
            try {
              /* Live shape: {type, postId, data:{postId,liked,likeCount}}.
                 Like toggles arrive as COMMENT events do not; the comment
                 counter only moves via reload-after-write today. */
              const event = JSON.parse(msg.body) as CommunityFeedEvent;
              if (event.type !== "LIKE_COUNT_CHANGED") return;
              handlerRef.current({
                postId: event.postId,
                likeCount: event.data.likeCount,
                likedByCurrentUser: event.data.liked,
              });
            } catch {
              // A malformed frame is skipped, not fatal.
            }
          });
        },
      });
      client.activate();
      clientRef.current = client;
    } catch {
      // No socket is survivable; polling and row reloads carry the page.
    }

    return () => {
      clientRef.current?.deactivate();
      clientRef.current = null;
    };
  }, [enabled]);
}

/*
  Per-post comment events, verified live 2026-09-09 on /topic/posts/{postId}:

  {"type":"COMMENT_CREATED","postId":12,"data":{...CommentResponse},"timestamp":...}
  {"type":"COMMENT_DELETED","postId":12,"data":{commentId,parentCommentId},"timestamp":...}

  A reply carries parentCommentId in data; the thread panel uses that to
  decide whether to refetch the root list or one comment's replies.
  Deletions of a reply name the removed reply; deleting a parent answer is a
  separate COMMENT_DELETED per row, so no special casing is needed.
*/

export type PostCommentEvent = {
  type: "COMMENT_CREATED" | "COMMENT_DELETED" | (string & {});
  postId: number;
  data: unknown;
  timestamp: string;
};

type UsePostCommentsSocketOptions = {
  /** The post whose comment thread is open. Null disables the socket. */
  postId: number | null;
  onCommentEvent: (event: PostCommentEvent) => void;
};

export function usePostCommentsSocket({
  postId,
  onCommentEvent,
}: UsePostCommentsSocketOptions) {
  const handlerRef = useRef(onCommentEvent);
  const clientRef = useRef<Client | null>(null);

  useEffect(() => {
    handlerRef.current = onCommentEvent;
  }, [onCommentEvent]);

  useEffect(() => {
    if (postId === null || clientRef.current) return;

    const token = getSession()?.token.accessToken;
    const wsUrl = API_BASE_URL.replace(/^http/, "ws") + "/ws-chat";

    let client: Client;
    try {
      client = new Client({
        brokerURL: wsUrl,
        connectHeaders: token ? { Authorization: `Bearer ${token}` } : {},
        reconnectDelay: 5000,
        heartbeatIncoming: 4000,
        heartbeatOutgoing: 4000,
        onConnect: () => {
          client.subscribe(`/topic/posts/${postId}`, (msg) => {
            try {
              handlerRef.current(JSON.parse(msg.body) as PostCommentEvent);
            } catch {
              // A malformed frame is skipped, not fatal.
            }
          });
        },
      });
      client.activate();
      clientRef.current = client;
    } catch {
      // The thread still works over REST; the socket is a bonus.
    }

    return () => {
      clientRef.current?.deactivate();
      clientRef.current = null;
    };
  }, [postId]);
}