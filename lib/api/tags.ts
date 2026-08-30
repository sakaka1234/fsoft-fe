import { apiFetch } from "@/lib/api/client";
import type { TagResponse } from "@/lib/api/types";

/*
  Tags.

  RENAME AND DELETE ARE GONE FROM THIS CONTROLLER. PUT /tags/{id} and
  DELETE /tags/{id} used to exist and this file used to call them; they now
  answer HTTP 500 "No static resource tags/{id}", which is how this backend
  spells 404. Verified live with an ordinary account.

  They moved to /admin/tags/{id}, so editing and deleting a tag is an admin
  action now. renameAdminTag and deleteAdminTag in lib/api/admin.ts are the
  replacements, and components/app/tags-view.tsx offers those two controls only
  to an admin for that reason.

  Anyone can still read every tag and create one.
*/

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
