"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { List } from "@phosphor-icons/react/List";
import { X } from "@phosphor-icons/react/X";

import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { navItems, primaryCta, signInCta, site } from "@/content/site";
import { logout } from "@/lib/api/auth";
import { endSession } from "@/lib/auth/session-store";
import { useSession } from "@/lib/auth/use-session";
import { EASE_OUT } from "@/lib/motion";

/**
 * Single line at desktop, 64px mobile / 68px desktop. The only z-index on the
 * page besides the mobile panel it owns.
 */
export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();
  const session = useSession();
  const router = useRouter();

  async function onLogout() {
    const accessToken = session?.token.accessToken;
    // Clear locally first so the header responds even if the call fails.
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

  const displayName = session?.user.fullName?.trim() || session?.user.email;

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-paper/85 backdrop-blur-md">
      <Container size="wide">
        <div className="flex h-16 items-center justify-between gap-6 md:h-17">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2.5"
            aria-label={`${site.fullName}, home`}
          >
            <span className="flex size-7 items-center justify-center rounded-lg bg-accent font-mono text-[0.7rem] font-semibold tracking-tight text-accent-fg">
              AE
            </span>
            <span className="text-[0.95rem] font-semibold tracking-tight">
              {site.name}
            </span>
          </Link>

          <nav
            aria-label="Primary"
            className="hidden items-center gap-7 lg:flex"
          >
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-sm text-muted transition-colors hover:text-ink"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle />

            {session ? (
              <div className="hidden items-center gap-2 sm:flex">
                <span className="max-w-32 truncate px-2 text-sm text-muted">
                  {displayName}
                </span>
                <ButtonLink href="/dashboard">Dashboard</ButtonLink>
                <Button variant="secondary" onClick={onLogout}>
                  Log out
                </Button>
              </div>
            ) : (
              <div className="hidden items-center gap-2 sm:flex">
                <Link
                  href={signInCta.href}
                  className="px-3 text-sm text-muted transition-colors hover:text-ink"
                >
                  {signInCta.label}
                </Link>
                <ButtonLink href={primaryCta.href}>
                  {primaryCta.label}
                </ButtonLink>
              </div>
            )}

            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              aria-expanded={open}
              aria-controls="mobile-nav"
              aria-label={open ? "Close menu" : "Open menu"}
              className="flex size-10 items-center justify-center rounded-full border border-line text-ink transition-colors hover:bg-surface-2 lg:hidden"
            >
              {open ? <X size={18} /> : <List size={18} />}
            </button>
          </div>
        </div>
      </Container>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            id="mobile-nav"
            key="mobile-nav"
            initial={reduce ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: EASE_OUT }}
            className="overflow-hidden border-t border-line bg-paper lg:hidden"
          >
            <Container size="wide">
              <nav aria-label="Primary mobile" className="flex flex-col py-4">
                {navItems.map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="border-b border-line py-3.5 text-base text-ink last:border-b-0"
                  >
                    {item.label}
                  </a>
                ))}

                {session ? (
                  <div className="mt-4 mb-2 flex flex-col gap-3 sm:hidden">
                    <span className="truncate text-sm text-muted">
                      Signed in as {displayName}
                    </span>
                    <ButtonLink href="/dashboard" size="lg" className="w-full">
                      Dashboard
                    </ButtonLink>
                    <Button
                      variant="secondary"
                      size="lg"
                      onClick={onLogout}
                      className="w-full"
                    >
                      Log out
                    </Button>
                  </div>
                ) : (
                  <div className="mt-4 mb-2 flex flex-col gap-3 sm:hidden">
                    <ButtonLink
                      href={primaryCta.href}
                      size="lg"
                      className="w-full"
                    >
                      {primaryCta.label}
                    </ButtonLink>
                    <ButtonLink
                      href={signInCta.href}
                      variant="secondary"
                      size="lg"
                      className="w-full"
                    >
                      {signInCta.label}
                    </ButtonLink>
                  </div>
                )}
              </nav>
            </Container>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
