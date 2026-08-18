import { apiFetch } from "@/lib/api/client";
import type {
  UserActivityResponse,
  UserStreakResponse,
} from "@/lib/api/types";

/**
 * Current and longest run of consecutive active days.
 *
 * A brand new account answers zeroes with a null lastActiveDate rather than
 * 404ing, so callers can render the card without a special empty branch.
 * Verified live on a freshly registered user.
 */
export function getStreak(signal?: AbortSignal) {
  return apiFetch<UserStreakResponse>("/progress/streak", {
    auth: true,
    signal,
  });
}

/**
 * One row per active day, for a heat map or a chart.
 *
 * Both bounds are optional despite the OpenAPI document listing them: omitting
 * them answers 200 with the full history. Dates are plain ISO days, no time.
 */
export function listActivities(
  range: { startDate?: string; endDate?: string } = {},
  signal?: AbortSignal,
) {
  const params = new URLSearchParams();
  if (range.startDate) params.set("startDate", range.startDate);
  if (range.endDate) params.set("endDate", range.endDate);

  const query = params.toString();
  return apiFetch<UserActivityResponse[]>(
    `/progress/activities${query ? `?${query}` : ""}`,
    { auth: true, signal },
  );
}
