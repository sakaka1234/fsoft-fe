import { cn } from "@/lib/cn";

type SectionProps = {
  children: React.ReactNode;
  id?: string;
  /**
   * Both tones live inside the active theme. `tinted` is a background step,
   * never a light section on a dark page or the other way round.
   */
  tone?: "paper" | "tinted";
  className?: string;
  "aria-labelledby"?: string;
};

export function Section({
  children,
  id,
  tone = "paper",
  className,
  ...rest
}: SectionProps) {
  return (
    <section
      id={id}
      className={cn(
        "py-20 md:py-28",
        tone === "tinted" && "bg-surface-2",
        className,
      )}
      {...rest}
    >
      {children}
    </section>
  );
}
