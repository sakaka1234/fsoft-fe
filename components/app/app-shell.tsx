"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { List } from "@phosphor-icons/react/List";
import { X } from "@phosphor-icons/react/X";
import { UserCircle } from "@phosphor-icons/react/UserCircle";
import { SignOut } from "@phosphor-icons/react/SignOut";
import { ChartBar } from "@phosphor-icons/react/ChartBar";

import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Spinner } from "@/components/ui/spinner";
import { Avatar } from "@/components/app/community-post-card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { NotificationBell } from "@/components/app/notification-bell";
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
  { label: "Ôn tập", href: "/decks?tab=srs" },
  { label: "Explore", href: "/explore" },
  { label: "Tra từ", href: "/search" },
  { label: "Công cụ AI", href: "/ai" },
  { label: "Cộng đồng", href: "/community" },
  { label: "Chơi game", href: "/games" },
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
  // "/decks?tab=srs" shares the /decks pathname; the query is what picks the
  // tab, so it must never count as a child segment of /decks.
  if (href.includes("?")) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isReviewActive(
  pathname: string,
  search: string | null,
  href: string,
) {
  if (!href.includes("?")) return false;
  const [path, query] = href.split("?");
  return pathname === path && search === query.replace("tab=", "srs");
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
  const searchParams = useSearchParams();
  const searchTab = searchParams?.get("tab") ?? null;
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
  }, [lastDismissedCount, setIsToastOpen]);

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
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3">
        <Spinner size={36} label="Checking your session" />
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
                  const active = item.href.includes("?")
                    ? isReviewActive(pathname, searchTab, item.href)
                    : isActive(pathname, item.href);
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
                      {item.href === "/decks?tab=srs" ? (
                        <DueBadge count={dueCount} />
                      ) : null}
                    </Link>
                  );
                })}
              </nav>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <NotificationBell />
              <ThemeToggle />
              {/* Avatar menu: picture beside the name, opens the account
                  dropdown. Replaces the plain name + Log out pair so the
                  account identity is clickable in one place. */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="Menu tài khoản"
                    className="flex items-center gap-2 rounded-full border border-line bg-surface py-1 pl-1 pr-2.5 transition-colors hover:bg-surface-2 focus:outline-none focus:ring-2 focus:ring-accent"
                  >
                    <Avatar
                      name={displayName}
                      src={session.user.avatar}
                      className="size-8"
                    />
                    <span className="hidden max-w-32 truncate text-sm font-medium text-ink xl:block">
                      {displayName}
                    </span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuLabel className="truncate">
                    {displayName}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => router.push("/profile")}>
                    <UserCircle size={16} className="text-muted" />
                    Hồ sơ
                  </DropdownMenuItem>
                  {isAdmin(session) ? (
                    <DropdownMenuItem onClick={() => router.push("/admin")}>
                      <ChartBar size={16} className="text-muted" />
                      Quản trị
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onLogout} className="text-danger focus:text-danger">
                    <SignOut size={16} className="text-danger" />
                    Đăng xuất
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

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
                    const active = item.href.includes("?")
                      ? isReviewActive(pathname, searchTab, item.href)
                      : isActive(pathname, item.href);
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
                        {item.href === "/decks?tab=srs" ? (
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
