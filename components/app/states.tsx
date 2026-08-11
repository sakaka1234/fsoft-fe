import { Warning } from "@phosphor-icons/react/dist/ssr/Warning";

import { cn } from "@/lib/cn";

/**
 * Skeleton that matches the shape of what is coming, rather than a spinner, so
 * the layout does not jump when the data lands.
 */
export function CardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }, (_, index) => (
        <li
          key={index}
          className="h-40 animate-pulse rounded-card border border-line bg-surface-2 motion-reduce:animate-none"
        />
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
          className="h-20 animate-pulse rounded-card border border-line bg-surface-2 motion-reduce:animate-none"
        />
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
