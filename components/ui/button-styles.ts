import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary";
export type ButtonSize = "md" | "lg";

/*
  Contrast audit (WCAG AA), both directions, because a button has to clear its
  own label AND separate from the page behind it:
  - primary   light  white on #c2410c      label 5.18:1, on paper 5.02:1
              dark   #1c1917 on #ff9a34    label 8.20:1, on paper 9.10:1
  - secondary --ink label on --surface     15.9:1 light / 15.2:1 dark
  Labels are kept to three words max so nothing wraps at desktop.
*/
const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-accent text-accent-fg hover:bg-accent-hover",
  secondary: "bg-surface text-ink border border-line hover:bg-surface-2",
};

const SIZES: Record<ButtonSize, string> = {
  md: "h-10 px-5 text-sm",
  lg: "h-12 px-7 text-[0.95rem]",
};

/** Shared by the anchor and the real button element so they cannot drift. */
export function buttonClasses(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className?: string,
) {
  return cn(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold",
    "transition-colors duration-200 active:scale-[0.98] motion-reduce:active:scale-100",
    "disabled:cursor-not-allowed disabled:opacity-60",
    VARIANTS[variant],
    SIZES[size],
    className,
  );
}
