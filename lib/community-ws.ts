"use client";

import { useEffect, useRef } from "react";
import { Client } from "@stomp/stompjs";

import { API_BASE_URL } from "@/lib/api/client";
import { getSession } from "@/lib/auth/session-store";

/*
  Live post updates over the same STOMP broker the community chat uses. The
  broker path and topic names follow /ws-chat + /topic/community from
  community-chat-widget.tsx; the community topics piggyback on that broker.

  A closed socket or a failed handshake degrades to nothing: the feed still
  shows the data it loaded, and every write reloads its row, so real-time is
  a bonus rather than a dependency.
*/

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
          client.subscribe("/topic/community/posts", (msg) => {
            try {
              handlerRef.current(JSON.parse(msg.body) as CommunityPostEvent);
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