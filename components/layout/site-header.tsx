"use client";

import { useState, useSyncExternalStore } from "react";
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
import { cn } from "@/lib/cn";

/** Matches the bar's own height, h-16 mobile / h-17 desktop. */
const HEADER_HEIGHT = 68;

/**
 * Whether the bar is currently laid over the hero, read as an external store
 * rather than effect-driven state: the same shape the session store and the
 * reduced-motion query already use here, and the one that keeps the first
 * paint correct instead of flashing a solid bar before an effect can run.
 *
 * The hero owns #top. A page without one gets the solid bar.
 */
function subscribeToHeroPosition(onChange: () => void) {
  const hero = document.getElementById("top");
  if (!hero) return () => {};

  /* Shrinking the root's top edge by the bar's height makes this fire at
     exactly the moment the hero's bottom clears the bar, rather than when the
     hero has left the viewport altogether. */
  const observer = new IntersectionObserver(onChange, {
    rootMargin: `-${HEADER_HEIGHT}px 0px 0px 0px`,
  });

  observer.observe(hero);
  return () => observer.disconnect();
}

function readHeroPosition() {
  const hero = document.getElementById("top");
  return hero ? hero.getBoundingClientRect().bottom > HEADER_HEIGHT : false;
}

/** No layout on the server, but the hero is always the first thing on it. */
const readServerHeroPosition = () => true;

/**
 * Single line at desktop, 64px mobile / 68px desktop. The only z-index on the
 * page besides the mobile panel it owns.
 *
 * Over the hero it goes transparent and borrows the hero's dark palette, then
 * turns into the normal solid bar once that section has passed. Without this it
 * renders in the page theme, which on a light theme means a white slab laid
 * across an eighteenth century painting.
 */
export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();
  const session = useSession();
  const router = useRouter();

  const overHero = useSyncExternalStore(
    subscribeToHeroPosition,
    readHeroPosition,
    readServerHeroPosition,
  );

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
    <header
      className={cn(
        /* border-b stays on in both states so only its colour changes and the
           bar never gains or loses a pixel of height mid-scroll. bg-transparent
           is a utility and hero-dark a component class, so the utility layer
           wins and the palette arrives without the dark fill that comes with
           it. */
        "sticky top-0 z-50 border-b transition-colors duration-300",
        overHero
          ? "hero-dark border-transparent bg-transparent"
          : "border-line bg-paper/85 backdrop-blur-md",
      )}
    >
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
            {/* Down a step from what this bar used to carry, because the whole
                scale in globals.css moved up an eighth and these were already
                compensating for the same thing by hand. Net effect on screen is
                that the bar stays where it is while the page around it grows.
                The class is on the name rather than the whole link so the AE
                badge, whose glyphs sit on a solid accent fill, keeps its clean
                edges. */}
            <span
              className={cn(
                "text-lg font-semibold tracking-tight",
                overHero && "header-over-art",
              )}
            >
              {site.name}
            </span>
          </Link>

          <nav
            aria-label="Primary"
            className={cn(
              /* Tighter at lg and roomier from xl: five items at this size
                 would otherwise crowd the CTA on a 1024px viewport. */
              "hidden items-center gap-5 lg:flex xl:gap-7",
              overHero && "header-over-art",
            )}
          >
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-base text-muted transition-colors hover:text-ink"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle />

            {session ? (
              <div className="hidden items-center gap-2 sm:flex">
                <span
                  className={cn(
                    "max-w-32 truncate px-2 text-base text-muted",
                    overHero && "header-over-art",
                  )}
                >
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
                  className={cn(
                    "px-3 text-base text-muted transition-colors hover:text-ink",
                    overHero && "header-over-art",
                  )}
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
