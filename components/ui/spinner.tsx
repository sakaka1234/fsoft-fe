import { cn } from "@/lib/cn";

type SpinnerProps = {
  size?: number;
  className?: string;
  /** Accessible label announced to screen readers. */
  label?: string;
};

/**
 * Accent-colored ring spinner. Pure CSS rotation, honors prefers-reduced-motion
 * via the global animation rules in globals.css.
 */
export function Spinner({ size = 32, className, label = "Loading" }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label={label}
      className={cn("inline-block shrink-0", className)}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        className="animate-spin"
      >
        <circle
          cx="12"
          cy="12"
          r="9"
          stroke="currentColor"
          strokeWidth="3"
          className="text-line"
          opacity="0.6"
        />
        <path
          d="M21 12a9 9 0 0 0-9-9"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          className="text-accent"
        />
      </svg>
    </span>
  );
}