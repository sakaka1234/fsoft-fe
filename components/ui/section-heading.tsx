import { cn } from "@/lib/cn";
import { Reveal } from "@/components/ui/reveal";

type SectionHeadingProps = {
  /** ReactNode so callers can break lines or emphasise a phrase. */
  title: React.ReactNode;
  lead?: React.ReactNode;
  id?: string;
  align?: "left" | "center";
  className?: string;
};

/**
 * Headline and lead are always stacked vertically. No split header, no eyebrow
 * label: the section's place on the page is what categorises it.
 */
export function SectionHeading({
  title,
  lead,
  id,
  align = "left",
  className,
}: SectionHeadingProps) {
  return (
    <Reveal
      className={cn(
        "flex flex-col gap-4",
        align === "center" && "items-center text-center",
        className,
      )}
    >
      <h2
        id={id}
        className="max-w-[22ch] text-3xl font-semibold tracking-tight text-balance sm:text-4xl md:text-[2.75rem] md:leading-[1.08]"
      >
        {title}
      </h2>
      {lead ? (
        <p className="max-w-[58ch] text-base leading-relaxed text-muted md:text-lg">
          {lead}
        </p>
      ) : null}
    </Reveal>
  );
}
