import { apiFetch, apiUpload } from "@/lib/api/client";
import type { ProfileResponse, ProfileUpdateRequest } from "@/lib/api/types";

/**
 * The signed-in user's profile.
 *
 * Separate from the session user on purpose: the session carries identity
 * (email, roles) and this carries the editable presentation (display name,
 * bio, links, avatar). They overlap on fullName and disagree freely, since
 * only this endpoint writes it.
 */
export function getMyProfile(signal?: AbortSignal) {
  return apiFetch<ProfileResponse>("/profiles/me", { auth: true, signal });
}

/**
 * Partial update. Verified live: sending three fields left the other four at
 * their stored values rather than nulling them, so callers may send only what
 * changed.
 */
export function updateMyProfile(body: ProfileUpdateRequest) {
  return apiFetch<ProfileResponse>("/profiles/me", {
    method: "PUT",
    body,
    auth: true,
  });
}

/**
 * Avatar upload.
 *
 * A lone binary part named avatarFile, with no JSON "request" alongside it,
 * which is why apiUpload's request is optional. Returns the whole profile back
 * with the new avatar URL on it.
 */
export function uploadAvatar(avatarFile: File) {
  return apiUpload<ProfileResponse>("/profiles/me/avatar", {
    method: "PUT",
    files: { avatarFile },
    auth: true,
  });
}
