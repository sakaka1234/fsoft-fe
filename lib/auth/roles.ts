import type { Session } from "@/lib/auth/session-store";

/*
  Role checks for the session user.

  What is actually known about roles on this backend:

  - UserResponse.roles is RoleResponse[], objects with a `name`. Verified:
    /auth/register answers roles:[{"name":"USER"}].
  - The JWT carries the same information as a space separated `scope` claim
    with a ROLE_ prefix: "ROLE_USER CREATE_USER". So the two representations of
    the same role differ by that prefix.
  - AdminUserResponse, on the admin endpoints, really does use string[]
    instead. Confirmed live: /admin/users answers roles:["ADMIN"] for the same
    account whose login answers roles:[{"name":"ADMIN"}]. Two shapes, one
    concept, both current.

  The admin role is spelled "ADMIN" on the session user and "ROLE_ADMIN" in the
  JWT scope. Confirmed live: signing in as an admin answers
  roles:[{"name":"ADMIN"}] with scope "ROLE_ADMIN CREATE_PERMISSION ...".
  Both spellings stay accepted below, because the two representations really do
  coexist and matching only one would be a coin flip on which reaches here.

  This gate is cosmetic. It decides what to render, never what is allowed: the
  server refuses unauthorised calls regardless, and a reader who edits their
  own localStorage gains a broken screen, not access.
*/

const ADMIN_NAMES = new Set(["ADMIN", "ROLE_ADMIN"]);

/** Role names on the session user, normalised to bare upper case strings. */
export function sessionRoles(session: Session): string[] {
  return (session?.user.roles ?? []).map((role) => role.name.toUpperCase());
}

/** Whether the signed in reader holds an admin role. */
export function isAdmin(session: Session): boolean {
  return sessionRoles(session).some((name) => ADMIN_NAMES.has(name));
}
