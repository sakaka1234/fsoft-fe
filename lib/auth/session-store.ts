import type { TokenResponse, UserResponse } from "@/lib/api/types";

export type Session = {
  user: UserResponse;
  token: TokenResponse;
} | null;

const STORAGE_KEY = "ai-ems.session";

/*
  Session lives in localStorage, which means the tokens are readable by any
  script that runs on the page. That is the accepted tradeoff for a browser
  client talking straight to the API, and it is contained here: swapping to
  httpOnly cookies behind Next route handlers later only touches this file and
  the two calls that write to it.

  A plain external store rather than context state, so useSyncExternalStore can
  give the server a null snapshot while the client reads real storage, without
  the hydration mismatch a lazy useState initializer would cause.
*/
let session: Session = readStoredSession();
const listeners = new Set<() => void>();

function readStoredSession(): Session {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Session;
    return parsed?.token?.accessToken ? parsed : null;
  } catch {
    return null;
  }
}

function commit(next: Session) {
  session = next;
  try {
    if (next) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Private mode or blocked storage: the session holds for this page view.
  }
  listeners.forEach((listener) => listener());
}

export function subscribeToSession(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getSession(): Session {
  return session;
}

/** The server never has a session to render, so it always starts signed out. */
export function getServerSession(): Session {
  return null;
}

export function startSession(value: NonNullable<Session>) {
  commit(value);
}

export function endSession() {
  commit(null);
}
