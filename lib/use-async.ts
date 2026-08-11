"use client";

import { useCallback, useEffect, useState } from "react";

import { ApiError } from "@/lib/api/client";

export type AsyncState<T> =
  | { status: "loading"; data: null; error: null }
  | { status: "success"; data: T; error: null }
  | { status: "error"; data: null; error: string };

/**
 * Runs a request when the component mounts and whenever `key` changes, and
 * hands back a `reload` for after a write.
 *
 * State is only ever set from the promise continuation, never straight from
 * the effect body: a synchronous set during an effect is what the
 * react-hooks/set-state-in-effect rule is there to catch, and it also causes
 * an extra render before paint.
 */
export function useAsync<T>(
  run: (signal: AbortSignal) => Promise<T>,
  key: string,
): AsyncState<T> & { reload: () => void } {
  const [state, setState] = useState<AsyncState<T>>({
    status: "loading",
    data: null,
    error: null,
  });
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((value) => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();

    run(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setState({ status: "success", data, error: null });
        }
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          status: "error",
          data: null,
          error:
            error instanceof ApiError
              ? error.message
              : "Something went wrong loading this.",
        });
      });

    return () => controller.abort();
    // `run` is rebuilt on every render by design, so the key names what the
    // request actually depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, nonce]);

  return { ...state, reload };
}
