import { Warning } from "@phosphor-icons/react/dist/ssr/Warning";
import { cn } from "@/lib/cn";

/**
 * High-contrast, elegant Skeleton loaders matching component dimensions.
 */

export function SingleCardSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-6 py-4">
      {/* Flashcard container skeleton */}
      <div className="relative aspect-[1.58/1] w-full animate-pulse rounded-3xl border border-line bg-surface p-8 shadow-card flex flex-col justify-between overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <div className="h-4 w-16 rounded-full bg-black/10 dark:bg-white/15" />
          <div className="h-6 w-20 rounded-full bg-black/10 dark:bg-white/15" />
        </div>

        {/* Center content */}
        <div className="flex flex-col items-center justify-center gap-3 py-6 text-center">
          <div className="h-9 w-48 rounded-xl bg-black/15 dark:bg-white/20" />
          <div className="h-4 w-32 rounded-md bg-black/10 dark:bg-white/15" />
        </div>

        {/* Bottom hint */}
        <div className="flex items-center justify-center">
          <div className="h-3.5 w-36 rounded-full bg-black/10 dark:bg-white/15" />
        </div>
      </div>

      {/* Control buttons skeleton */}
      <div className="flex items-center justify-center gap-3">
        <div className="h-10 w-24 animate-pulse rounded-full bg-black/10 dark:bg-white/15" />
        <div className="h-10 w-32 animate-pulse rounded-full bg-black/10 dark:bg-white/15" />
        <div className="h-10 w-24 animate-pulse rounded-full bg-black/10 dark:bg-white/15" />
      </div>
    </div>
  );
}

export function CardSkeleton({ count = 6 }: { count?: number }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }, (_, index) => (
        <li
          key={index}
          className="flex flex-col justify-between h-44 animate-pulse rounded-card border border-line bg-surface p-6 shadow-2xs"
        >
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="h-5 w-36 rounded-lg bg-black/15 dark:bg-white/20" />
              <div className="h-6 w-16 rounded-full bg-black/10 dark:bg-white/15" />
            </div>
            <div className="h-3.5 w-4/5 rounded-md bg-black/10 dark:bg-white/15" />
          </div>
          <div className="flex items-center justify-between pt-4 border-t border-line/60">
            <div className="h-4 w-20 rounded-full bg-black/10 dark:bg-white/15" />
            <div className="h-4 w-12 rounded-full bg-black/10 dark:bg-white/15" />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function RowSkeleton({ count = 4 }: { count?: number }) {
  return (
    <ul className="flex flex-col gap-3">
      {Array.from({ length: count }, (_, index) => (
        <li
          key={index}
          className="flex items-start gap-4 rounded-card border border-line bg-surface p-5 animate-pulse shadow-2xs"
        >
          {/* Index position */}
          <div className="mt-1 h-5 w-6 rounded bg-black/15 dark:bg-white/20" />

          {/* Card main info */}
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-6 w-36 rounded-lg bg-black/15 dark:bg-white/20" />
              <div className="h-4 w-20 rounded-md bg-black/10 dark:bg-white/15" />
              <div className="h-5 w-14 rounded-full bg-black/10 dark:bg-white/15" />
            </div>
            <div className="h-4 w-2/3 rounded-md bg-black/10 dark:bg-white/15" />
            <div className="h-10 w-full rounded-xl bg-black/5 dark:bg-white/10" />
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1">
            <div className="h-8 w-8 rounded-full bg-black/10 dark:bg-white/15" />
            <div className="h-8 w-8 rounded-full bg-black/10 dark:bg-white/15" />
            <div className="h-8 w-8 rounded-full bg-black/10 dark:bg-white/15" />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-card border border-danger/40 bg-danger/8 p-6">
      <p role="alert" className="flex items-start gap-2.5 text-sm text-ink">
        <Warning
          aria-hidden
          size={17}
          weight="fill"
          className="mt-px shrink-0 text-danger"
        />
        {message}
      </p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="text-sm font-medium text-accent-text underline underline-offset-4"
        >
          Try again
        </button>
      ) : null}
    </div>
  );
}

/** Empty states say what the surface is for and how to fill it. */
export function EmptyState({
  title,
  body,
  action,
  className,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-start gap-3 rounded-card border border-dashed border-line p-8",
        className,
      )}
    >
      <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
      <p className="max-w-[52ch] text-sm leading-relaxed text-muted">{body}</p>
      {action}
    </div>
  );
}
