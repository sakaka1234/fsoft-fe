"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { site } from "@/content/site";
import { logout } from "@/lib/api/auth";
import { endSession, getSession } from "@/lib/auth/session-store";
import { useSession } from "@/lib/auth/use-session";
import { cn } from "@/lib/cn";

import { useState, useCallback } from "react";
import { getFsrsStudyQueue } from "@/lib/api/fsrs";
import { FsrsNotificationToast } from "@/components/app/fsrs-notification-toast";

const APP_NAV = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Decks", href: "/decks" },
  { label: "Explore", href: "/explore" },
  { label: "Tags", href: "/tags" },
  { label: "Profile", href: "/profile" },
] as const;

/**
 * Exact match, or a real child segment. A plain startsWith would light up
 * "/decks" while sitting on a future "/decks-archive", and every prefix that
 * happens to share leading characters.
 */
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
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const session = useSession();
  const router = useRouter();
  const pathname = usePathname();

  const [dueCount, setDueCount] = useState(0);
  const [isToastOpen, setIsToastOpen] = useState(false);
  const [lastDismissedCount, setLastDismissedCount] = useState(0);

  const fetchDueQueue = useCallback(async () => {
    try {
      const queue = await getFsrsStudyQueue(undefined, 120, 30);
      const count = queue.length;
      setDueCount(count);
      if (count > 0 && count !== lastDismissedCount) {
        setIsToastOpen(true);
      }
    } catch {
      // Ignore background errors
    }
  }, [lastDismissedCount]);

  // Initial check on mount/F5 & 5-minute periodic interval
  useEffect(() => {
    if (!getSession()) {
      router.replace("/login");
      return;
    }

    fetchDueQueue();

    // 5-minute background reminder polling (5 * 60 * 1000 ms)
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        fetchDueQueue();
      }
    }, 5 * 60 * 1000);

    // Re-check when browser tab becomes active
    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        fetchDueQueue();
      }
    }

    window.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [router, session, fetchDueQueue]);

  async function onLogout() {
    const accessToken = getSession()?.token.accessToken;
    endSession();
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
          <div className="flex h-16 items-center justify-between gap-6 md:h-17">
            <div className="flex items-center gap-8">
              <Link href="/" className="flex shrink-0 items-center gap-2.5">
                <span className="flex size-7 items-center justify-center rounded-lg bg-accent font-mono text-[0.7rem] font-semibold tracking-tight text-accent-fg">
                  AE
                </span>
                <span className="text-[0.95rem] font-semibold tracking-tight">
                  {site.name}
                </span>
              </Link>

              <nav aria-label="Workspace" className="flex items-center gap-6">
                {APP_NAV.map((item) => {
                  const active = isActive(pathname, item.href);
                  const isDecksLink = item.href === "/decks";
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "relative flex items-center gap-1.5 text-sm transition-colors",
                        active ? "text-ink font-medium" : "text-muted hover:text-ink",
                      )}
                    >
                      {item.label}
                      {isDecksLink && dueCount > 0 ? (
                        <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1.5 font-mono text-[0.7rem] font-bold text-white shadow-sm animate-pulse">
                          {dueCount}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </nav>
            </div>

            <div className="flex items-center gap-2">
              <ThemeToggle />
              <span className="hidden max-w-40 truncate text-sm text-muted sm:block">
                {displayName}
              </span>
              <Button variant="secondary" onClick={onLogout}>
                Log out
              </Button>
            </div>
          </div>
        </Container>
      </header>

      <main className="flex-1 py-10 md:py-14">{children}</main>

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
