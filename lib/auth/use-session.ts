"use client";

import { useSyncExternalStore } from "react";

import {
  getServerSession,
  getSession,
  subscribeToSession,
} from "@/lib/auth/session-store";

/** Current session, or null when signed out. Re-renders on sign in and out. */
export function useSession() {
  return useSyncExternalStore(
    subscribeToSession,
    getSession,
    getServerSession,
  );
}
