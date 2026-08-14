"use client";

import { useCallback, useEffect, useState } from "react";

import { ApiError } from "@/lib/api/client";

export type AsyncState<T> =
  | { status: "loading"; data: null; error: null }
  | { status: "success"; data: T; error: null }
  | { status: "error"; data: null; error: string };

/** Global in-memory client cache for SWR-style instant rendering */
const globalCache = new Map<string, unknown>();

/** Purges or invalidates cached data by key or prefix */
export function invalidateCache(keyPrefix?: string) {
  if (!keyPrefix) {
    globalCache.clear();
  } else {
    for (const key of globalCache.keys()) {
      if (key.startsWith(keyPrefix)) {
        globalCache.delete(key);
      }
    }
  }
}

/**
 * Runs a request and caches results in-memory for instant client-side rendering.
 * Provides Stale-While-Revalidate (SWR) behavior when navigating between views.
 */
export function useAsync<T>(
  run: (signal: AbortSignal) => Promise<T>,
  key: string,
): AsyncState<T> & { reload: () => void } {
  const cachedData = globalCache.get(key) as T | undefined;

  const [state, setState] = useState<AsyncState<T>>(() => {
    if (cachedData !== undefined) {
      return { status: "success", data: cachedData, error: null };
    }
    return { status: "loading", data: null, error: null };
  });

  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => {
    globalCache.delete(key);
    setNonce((value) => value + 1);
  }, [key]);

  useEffect(() => {
    const controller = new AbortController();

    run(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          globalCache.set(key, data);
          setState({ status: "success", data, error: null });
        }
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (!globalCache.has(key)) {
          setState({
            status: "error",
            data: null,
            error:
              error instanceof ApiError
                ? error.message
                : "Something went wrong loading this.",
          });
        }
      });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, nonce]);

  return { ...state, reload };
}
