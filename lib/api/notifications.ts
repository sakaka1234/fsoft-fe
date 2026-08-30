import { apiFetch } from "@/lib/api/client";
import type {
  NotificationCreateRequest,
  NotificationResponse,
} from "@/lib/api/types";

/*
  Notifications.

  Three findings from probing this group shape everything below, and two of
  them limit what the UI is allowed to claim:

  1. GET /notifications returns a FLAT ARRAY, not a page. There is no
     totalElements, no totalPages, no hasNext, and no count header, even though
     it accepts page and size. So a numbered pager is impossible; the only
     honest control is "load more", stopping when a short page comes back.
  2. `read` is hardcoded false in every response from every endpoint here, even
     immediately after marking a row read, and even though the change really
     does persist. A per row read indicator would therefore be a lie. The
     unread COUNT endpoint is accurate, so the bell badge is truthful while the
     list cannot mark individual rows.
  3. `sort` is accepted and ignored. The list is permanently newest first.

  Paging is zero based here, like the card routes and unlike the deck routes.
*/

/** Page size used across the notification screens. */
export const NOTIFICATION_PAGE_SIZE = 20;

/**
 * One page of notifications, newest first.
 *
 * Returns a bare array. A full page means there may be more; a short one means
 * the end. That is the only end-of-list signal available.
 */
export function listNotifications(
  page = 0,
  size = NOTIFICATION_PAGE_SIZE,
  signal?: AbortSignal,
) {
  return apiFetch<NotificationResponse[]>(
    `/notifications?page=${page}&size=${size}`,
    { auth: true, signal },
  );
}

/** Unread count. The one number in this group that is actually maintained. */
export function getUnreadNotificationCount(signal?: AbortSignal) {
  return apiFetch<number>("/notifications/unread-count", {
    auth: true,
    signal,
  });
}

/**
 * Mark one notification read.
 *
 * The returned row still says read:false. The change does persist and the
 * unread count does drop, so trust the count and re-read it rather than the
 * row you got back.
 */
export function markNotificationRead(id: number, signal?: AbortSignal) {
  return apiFetch<NotificationResponse>(`/notifications/${id}/read`, {
    method: "PATCH",
    auth: true,
    signal,
  });
}

/** Mark everything read. Answers an envelope with no data key. */
export function markAllNotificationsRead(signal?: AbortSignal) {
  return apiFetch<void>("/notifications/read-all", {
    method: "PATCH",
    auth: true,
    signal,
  });
}

export function deleteNotification(id: number, signal?: AbortSignal) {
  return apiFetch<void>(`/notifications/${id}`, {
    method: "DELETE",
    auth: true,
    signal,
  });
}

/**
 * Create a notification in someone's inbox.
 *
 * NOT WIRED INTO ANY SCREEN, deliberately. The server does not check that
 * recipientId is the caller, so any ordinary account can push a notification
 * into any other account's inbox. Exposing that in the UI would be building a
 * spam tool on top of a backend bug. It is kept here so the endpoint is
 * documented and so an admin tool can use it once the server enforces
 * ownership. See docs/backend-issues.md.
 */
export function createNotification(
  body: NotificationCreateRequest,
  signal?: AbortSignal,
) {
  return apiFetch<NotificationResponse>("/notifications", {
    method: "POST",
    body,
    auth: true,
    signal,
  });
}
