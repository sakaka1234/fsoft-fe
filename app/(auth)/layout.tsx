import Link from "next/link";

import { Container } from "@/components/ui/container";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { site } from "@/content/site";

/**
 * Auth shell. Deliberately lighter than the marketing chrome: no nav, no
 * footer links, one way back to the landing page, so there is nothing to
 * distract from finishing the form.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-line">
        <Container size="wide">
          <div className="flex h-16 items-center justify-between gap-6 md:h-17">
            <Link href="/" className="flex items-center gap-2.5">
              <span className="flex size-7 items-center justify-center rounded-lg bg-accent font-mono text-[0.7rem] font-semibold tracking-tight text-accent-fg">
                AE
              </span>
              <span className="text-[0.95rem] font-semibold tracking-tight">
                {site.name}
              </span>
            </Link>
            <ThemeToggle />
          </div>
        </Container>
      </header>

      <main className="flex flex-1 items-center py-12 md:py-16">{children}</main>
    </div>
  );
}
