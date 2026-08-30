"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { List } from "@phosphor-icons/react/List";
import { X } from "@phosphor-icons/react/X";

import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { site } from "@/content/site";
import { logout } from "@/lib/api/auth";
import { endSession, getSession } from "@/lib/auth/session-store";
import { isAdmin } from "@/lib/auth/roles";
import { useSession } from "@/lib/auth/use-session";
import { EASE_OUT } from "@/lib/motion";
import { cn } from "@/lib/cn";
import { getFsrsStudyQueue } from "@/lib/api/fsrs";
import { FsrsNotificationToast } from "@/components/app/fsrs-notification-toast";

const APP_NAV = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Decks", href: "/decks" },
  { label: "Explore", href: "/explore" },
  { label: "Tags", href: "/tags" },
  { label: "Tra từ", href: "/search" },
  { label: "Chơi game", href: "/games" },
  { label: "Profile", href: "/profile" },
] as const;

/**
 * Exact match, or a real child segment. A plain startsWith would light up
 * "/decks" while sitting on a future "/decks-archive", and every prefix that
 * happens to share leading characters.
 */
/**
 * Count of cards due for review, shown against the Decks link.
 *
 * bg-danger rather than a literal rose: every other colour on this page
 * comes from a token, and a hardcoded red would not follow the theme.
 * text-paper reads against danger in both themes, because paper and danger
 * invert together. No pulse either: a badge that never stops moving is noise
 * once you have seen it, and it would have to be gated on
 * prefers-reduced-motion to be shippable at all.
 */
function DueBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span
      aria-label={String(count) + " thẻ tới hạn ôn tập"}
      className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-danger px-1.5 font-mono text-[0.7rem] font-bold text-paper"
    >
      {count}
    </span>
  );
}

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Chrome and gate for the signed-in area.
 *
 * The redirect lives in an effect and reads the store directly rather than the
 * hook value. The hook starts from the server snapshot (always null) and only
 * settles after hydration, so trusting it during render would bounce a signed
 * in reader straight back to the sign in page.
 *
 * The bar collapses to a menu below lg. It used to render all six workspace
 * links inline at every width with no fallback, which ran the nav into the
 * account controls and pushed Log out off the right edge on a narrow window.
 * The marketing header has carried a mobile panel all along; this is the same
 * pattern, so the two headers behave alike.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const session = useSession();

  /*
    The console link only exists for an admin. This hides a door that would
    open onto four failing panels for everyone else; it is not access control,
    which lives on the server.
  */
  const nav = useMemo(
    () =>
      isAdmin(session)
        ? [...APP_NAV, { label: "Quản trị", href: "/admin" as const }]
        : APP_NAV,
    [session],
  );
  const router = useRouter();
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);

  const [dueCount, setDueCount] = useState(0);
  const [isToastOpen, setIsToastOpen] = useState(false);
  const [lastDismissedCount, setLastDismissedCount] = useState(0);

  /* setState inside .then rather than after an await in an async body: the
     react-hooks/set-state-in-effect rule reads the effect body statically and
     cannot see that the await defers it. lib/use-async.ts is shaped the same
     way for the same reason. */
  const fetchDueQueue = useCallback(() => {
    getFsrsStudyQueue(undefined, 120, 30)
      .then((queue) => {
        const count = queue.length;
        setDueCount(count);
        /* Only reopen for a count the reader has not already dismissed, or
           every poll would put the same toast back on screen. */
        if (count > 0 && count !== lastDismissedCount) setIsToastOpen(true);
      })
      .catch(() => {
        // A background reminder is not worth surfacing an error for.
      });
  }, [lastDismissedCount]);

  useEffect(() => {
    if (!getSession()) {
      router.replace("/login");
      return;
    }

    fetchDueQueue();

    const interval = setInterval(
      () => {
        if (document.visibilityState === "visible") fetchDueQueue();
      },
      5 * 60 * 1000,
    );

    /* On document, which is where visibilitychange is fired. Polling alone
       would leave a tab that slept for an hour showing a stale count. */
    function onVisibility() {
      if (document.visibilityState === "visible") fetchDueQueue();
    }
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [router, session, fetchDueQueue]);

  async function onLogout() {
    const accessToken = getSession()?.token.accessToken;
    endSession();
    setOpen(false);
    if (accessToken) {
      try {
        await logout(accessToken);
      } catch {
        // The token is gone from this browser either way.
      }
    }
    router.replace("/");
  }

  if (!session) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <p className="text-sm text-muted">Checking your session</p>
      </div>
    );
  }

  const displayName = session.user.fullName?.trim() || session.user.email;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-50 border-b border-line bg-paper/85 backdrop-blur-md">
        <Container size="wide">
          <div className="flex h-16 items-center justify-between gap-4 md:h-17">
            <div className="flex min-w-0 items-center gap-8">
              <Link href="/" className="flex shrink-0 items-center gap-2.5">
                {/* Logo lấy thẳng từ app/favicon.ico để favicon và logo luôn là một: đổi
                    favicon là đổi luôn logo, không phải nhớ cập nhật hai nơi. unoptimized vì
                    .ico không nằm trong các định dạng next/image xử lý được. */}
                <Image
                  src="/favicon.ico"
                  alt=""
                  width={28}
                  height={28}
                  unoptimized
                  className="size-7 shrink-0 rounded-full"
                />
                <span className="text-[0.95rem] font-semibold tracking-tight">
                  {site.name}
                </span>
              </Link>

              <nav
                aria-label="Workspace"
                className="hidden items-center gap-6 lg:flex"
              >
                {nav.map((item) => {
                  const active = isActive(pathname, item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-1.5 text-sm whitespace-nowrap transition-colors",
                        active ? "text-ink" : "text-muted hover:text-ink",
                      )}
                    >
                      {item.label}
                      {item.href === "/decks" ? (
                        <DueBadge count={dueCount} />
                      ) : null}
                    </Link>
                  );
                })}
              </nav>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <ThemeToggle />
              {/* Only from xl: at lg the six links plus a name plus a button is
                  already the width of the bar. */}
              <span className="hidden max-w-40 truncate text-sm text-muted xl:block">
                {displayName}
              </span>
              <Button
                variant="secondary"
                onClick={onLogout}
                className="hidden lg:inline-flex"
              >
                Log out
              </Button>

              <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                aria-expanded={open}
                aria-controls="workspace-nav"
                aria-label={open ? "Đóng menu" : "Mở menu"}
                className="flex size-10 shrink-0 items-center justify-center rounded-full border border-line text-ink transition-colors hover:bg-surface-2 lg:hidden"
              >
                {open ? <X size={18} /> : <List size={18} />}
              </button>
            </div>
          </div>
        </Container>

        <AnimatePresence initial={false}>
          {open ? (
            <motion.div
              id="workspace-nav"
              key="workspace-nav"
              initial={reduce ? false : { height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
              transition={{ duration: 0.28, ease: EASE_OUT }}
              className="overflow-hidden border-t border-line bg-paper lg:hidden"
            >
              <Container size="wide">
                <nav
                  aria-label="Workspace mobile"
                  /* The header is sticky, so a panel taller than the viewport
                     would put Log out somewhere page scroll cannot reach.
                     Cap it against the bar height and scroll inside. */
                  className="flex max-h-[calc(100dvh-4rem)] flex-col overflow-y-auto py-4 md:max-h-[calc(100dvh-4.25rem)]"
                >
                  {nav.map((item) => {
                    const active = isActive(pathname, item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        /* Closed on tap rather than by watching pathname in an
                           effect, which would be a synchronous setState there. */
                        onClick={() => setOpen(false)}
                        className={cn(
                          "flex items-center gap-2 border-b border-line py-3.5 text-base last:border-b-0",
                          active ? "text-ink" : "text-muted",
                        )}
                      >
                        {item.label}
                        {item.href === "/decks" ? (
                          <DueBadge count={dueCount} />
                        ) : null}
                      </Link>
                    );
                  })}

                  <div className="mt-4 mb-2 flex flex-col gap-3">
                    <span className="truncate text-sm text-muted">
                      Đang đăng nhập: {displayName}
                    </span>
                    <Button
                      variant="secondary"
                      size="lg"
                      onClick={onLogout}
                      className="w-full"
                    >
                      Log out
                    </Button>
                  </div>
                </nav>
              </Container>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </header>

      <main className="flex-1 pt-4 pb-10 md:pt-6 md:pb-14">{children}</main>

      <FsrsNotificationToast
        count={dueCount}
        isOpen={isToastOpen}
        onClose={() => {
          setIsToastOpen(false);
          setLastDismissedCount(dueCount);
        }}
        onStartReview={() => {
          setIsToastOpen(false);
          router.push("/decks?tab=srs");
        }}
      />
    </div>
  );
}
