import { apiFetch } from "@/lib/api/client";
import type { TagResponse } from "@/lib/api/types";

export function listTags(signal?: AbortSignal) {
  return apiFetch<TagResponse[]>("/tags", { auth: true, signal });
}

export function createTag(name: string) {
  return apiFetch<TagResponse>("/tags", {
    method: "POST",
    body: { name },
    auth: true,
  });
}

export function renameTag(id: number, name: string) {
  return apiFetch<TagResponse>(`/tags/${id}`, {
    method: "PUT",
    body: { name },
    auth: true,
  });
}

export function deleteTag(id: number) {
  return apiFetch<void>(`/tags/${id}`, { method: "DELETE", auth: true });
}
