import type { Session } from "@/lib/auth/session-store";

/*
  Role checks for the session user.

  What is actually known about roles on this backend:

  - UserResponse.roles is RoleResponse[], objects with a `name`. Verified:
    /auth/register answers roles:[{"name":"USER"}].
  - The JWT carries the same information as a space separated `scope` claim
    with a ROLE_ prefix: "ROLE_USER CREATE_USER". So the two representations of
    the same role differ by that prefix.
  - AdminUserResponse, on the admin endpoints, declares roles as string[]
    instead. That is the OpenAPI document's claim and it has never been seen,
    since no admin token was available.

  The admin role's exact spelling is therefore NOT confirmed. Both "ADMIN" and
  "ROLE_ADMIN" are accepted below rather than betting on one, because the cost
  of guessing wrong is an admin who cannot see the admin screens and has no way
  to tell why.

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
