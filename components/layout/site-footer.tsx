import Image from "next/image";

import { Container } from "@/components/ui/container";
import { footerColumns, site } from "@/content/site";

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-paper">
      <Container size="wide">
        <div className="grid gap-12 py-16 md:grid-cols-12 md:py-20">
          <div className="flex flex-col gap-3 md:col-span-5">
            <div className="flex items-center gap-2.5">
              {/* Cùng nguồn với favicon, xem chú thích ở site-header. */}
              <Image
                src="/favicon.ico"
                alt=""
                width={28}
                height={28}
                unoptimized
                className="size-7 shrink-0 rounded-full"
              />
              <span className="text-[0.95rem] font-semibold tracking-tight">
                {site.fullName}
              </span>
            </div>
            <p className="max-w-[34ch] text-lg leading-snug text-muted">
              {site.tagline}
            </p>
          </div>

          <div className="grid gap-10 sm:grid-cols-3 md:col-span-7">
            {footerColumns.map((column) => (
              <div key={column.title} className="flex flex-col gap-4">
                <h2 className="text-sm font-medium text-ink">{column.title}</h2>
                <ul className="flex flex-col gap-3">
                  {column.links.map((link) => (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        className="text-sm text-muted transition-colors hover:text-ink"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-line py-7">
          <p className="text-sm text-muted">{site.copyright}</p>
        </div>
      </Container>
    </footer>
  );
}
