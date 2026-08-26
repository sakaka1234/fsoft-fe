"use client";

import { AdminView } from "@/components/app/admin-view";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/app/states";
import { ButtonLink } from "@/components/ui/button-link";
import { isAdmin } from "@/lib/auth/roles";
import { useSession } from "@/lib/auth/use-session";

/**
 * Keeps a non admin out of the console.
 *
 * This is presentation, not security. Every admin endpoint is refused by the
 * server for a token without the role, and someone who edits their own
 * localStorage gets a page whose every request fails. The point is that a
 * normal reader who lands here by typing the URL gets a plain explanation
 * instead of four failing panels.
 *
 * The session is read client side, so it is null on the first paint. That
 * renders as the signed-out branch for an instant, which is why the copy for
 * both cases is written to be true either way rather than accusing anyone of
 * anything.
 */
export function AdminGate() {
  const session = useSession();

  if (!isAdmin(session)) {
    return (
      <Container className="py-16">
        <EmptyState
          title="Khu vực quản trị"
          body="Trang này chỉ dành cho tài khoản có quyền quản trị. Nếu bạn cần truy cập, hãy liên hệ quản trị viên."
          action={<ButtonLink href="/dashboard">Về Dashboard</ButtonLink>}
        />
      </Container>
    );
  }

  return <AdminView />;
}
