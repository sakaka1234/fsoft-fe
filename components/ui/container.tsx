import { cn } from "@/lib/cn";

type ContainerProps = {
  children: React.ReactNode;
  /** `wide` is for full-bleed media rows, `default` for reading widths. */
  size?: "default" | "wide";
  className?: string;
};

export function Container({
  children,
  size = "default",
  className,
}: ContainerProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-5 sm:px-8",
        size === "wide" ? "max-w-[1400px]" : "max-w-6xl",
        className,
      )}
    >
      {children}
    </div>
  );
}
