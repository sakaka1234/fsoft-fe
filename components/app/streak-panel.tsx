"use client";

import { useCallback } from "react";
import { Flame } from "@phosphor-icons/react/Flame";
import { Trophy } from "@phosphor-icons/react/Trophy";

import { ErrorState } from "@/components/app/states";
import { getStreak, listActivities } from "@/lib/api/progress";
import type { UserActivityResponse } from "@/lib/api/types";
import { useAsync } from "@/lib/use-async";
import { cn } from "@/lib/cn";

const DAYS_SHOWN = 14;

/** Local calendar day as YYYY-MM-DD, which is the shape activityDate uses. */
function isoDay(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * The last DAYS_SHOWN days, oldest first, each carrying whatever the API had
 * for it. Built from the calendar rather than from the response because the
 * API returns only active days: the gaps are the interesting part of a streak
 * strip and they have no rows to iterate.
 */
function buildStrip(activities: UserActivityResponse[]) {
  const byDay = new Map(activities.map((a) => [a.activityDate, a]));
  const today = new Date();

  return Array.from({ length: DAYS_SHOWN }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (DAYS_SHOWN - 1 - index));
    const key = isoDay(date);
    const hit = byDay.get(key);
    return {
      key,
      cards: hit?.cardsReviewedCount ?? 0,
      quizzes: hit?.quizzesCompletedCount ?? 0,
    };
  });
}

function formatDay(iso: string | null) {
  if (!iso) return "not yet";
  const parsed = new Date(iso);
  return Number.isNaN(parsed.valueOf())
    ? iso
    : parsed.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/**
 * Streak and recent activity, from /progress/streak and /progress/activities.
 *
 * Two calls rather than one because they fail independently: a missing
 * activity history should still leave the streak numbers on screen. Both are
 * cheap and run in parallel through useAsync.
 */
export function StreakPanel() {
  const streak = useAsync(useCallback((signal) => getStreak(signal), []), "streak");
  const activities = useAsync(
    useCallback((signal) => listActivities({}, signal), []),
    "activities",
  );

  if (streak.status === "error") {
    return <ErrorState message={streak.error} onRetry={streak.reload} />;
  }

  const strip = buildStrip(activities.data ?? []);
  const busiest = Math.max(1, ...strip.map((day) => day.cards));

  return (
    <section
      aria-labelledby="streak-title"
      className="mt-10 rounded-card border border-line bg-surface p-6"
    >
      <h2 id="streak-title" className="sr-only">
        Your learning streak
      </h2>

      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="flex gap-8">
          <div className="flex flex-col gap-3">
            <Flame
              aria-hidden
              size={20}
              weight="duotone"
              className="text-accent-text"
            />
            <p className="font-mono text-3xl tracking-tight tabular-nums">
              {streak.status === "success" ? streak.data.currentStreak : "-"}
            </p>
            <p className="text-sm text-muted">Day streak</p>
          </div>

          <div className="flex flex-col gap-3">
            <Trophy
              aria-hidden
              size={20}
              weight="duotone"
              className="text-accent-text"
            />
            <p className="font-mono text-3xl tracking-tight tabular-nums">
              {streak.status === "success" ? streak.data.longestStreak : "-"}
            </p>
            <p className="text-sm text-muted">Longest run</p>
          </div>
        </div>

        <div className="min-w-0">
          <p className="text-sm text-muted">
            Last active{" "}
            {streak.status === "success"
              ? formatDay(streak.data.lastActiveDate)
              : "-"}
          </p>

          <ul className="mt-3 flex flex-wrap gap-1.5" aria-hidden>
            {strip.map((day) => (
              <li
                key={day.key}
                title={`${day.key}: ${day.cards} cards, ${day.quizzes} quizzes`}
                /* Opacity carries the intensity so the scale needs only one
                   colour token and stays legible in both themes. */
                className={cn(
                  "size-4 rounded-[4px]",
                  day.cards > 0 ? "bg-accent" : "bg-surface-2",
                )}
                style={
                  day.cards > 0
                    ? { opacity: 0.35 + 0.65 * (day.cards / busiest) }
                    : undefined
                }
              />
            ))}
          </ul>
          <p className="mt-2 text-sm text-muted">
            Last {DAYS_SHOWN} days
            {activities.status === "error" ? " unavailable" : ""}
          </p>
        </div>
      </div>
    </section>
  );
}
