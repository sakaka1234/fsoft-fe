import { BookOpenText } from "@phosphor-icons/react/dist/ssr/BookOpenText";
import { ChartLineUp } from "@phosphor-icons/react/dist/ssr/ChartLineUp";
import { ChatCircleDots } from "@phosphor-icons/react/dist/ssr/ChatCircleDots";
import { Compass } from "@phosphor-icons/react/dist/ssr/Compass";
import { ListChecks } from "@phosphor-icons/react/dist/ssr/ListChecks";
import { Microphone } from "@phosphor-icons/react/dist/ssr/Microphone";

import { Art } from "@/components/ui/art";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { SectionHeading } from "@/components/ui/section-heading";
import { Reveal } from "@/components/ui/reveal";
import { platform, type PlatformFeature } from "@/content/landing";
import { cn } from "@/lib/cn";
import { staggerDelay } from "@/lib/motion";

type IconComponent = React.ComponentType<{
  size?: number;
  weight?: "regular" | "duotone" | "bold";
  className?: string;
}>;

/** Icons live here, not in the copy module, so the copy stays serializable. */
const ICONS: Record<string, IconComponent> = {
  path: Compass,
  tutor: ChatCircleDots,
  speaking: Microphone,
  vocabulary: BookOpenText,
  assessments: ListChecks,
  analytics: ChartLineUp,
};

/*
  Bento rhythm, six items in six cells across three rows of six columns:
    4 + 2  /  2 + 4  /  4 + 2
  Sizes and art direction alternate, so no row repeats the one above it.

  Never put two background utilities on one element. Tailwind resolves them by
  their order in the generated stylesheet, not by the order they appear in the
  class string, so `bg-surface bg-accent` silently renders the surface color.
*/
const SHELL = "card-lift flex h-full flex-col rounded-card border p-6 md:p-7";
const SHELL_PLAIN = "border-line bg-surface";

type CellLayout = "stack" | "art-left" | "art-right";

function FeatureCell({
  feature,
  layout,
}: {
  feature: PlatformFeature;
  layout: CellLayout;
}) {
  const Icon = ICONS[feature.key];
  const horizontal = layout !== "stack";

  const copy = (
    <div className={cn(horizontal && "flex-1")}>
      <Icon size={24} weight="duotone" className="text-accent-text" />
      <h3 className="mt-4 text-xl font-semibold tracking-tight">
        {feature.title}
      </h3>
      <p className="mt-2 max-w-[42ch] text-sm leading-relaxed text-muted">
        {feature.body}
      </p>
    </div>
  );

  const media = feature.media ? (
    <Art
      src={feature.media.src}
      alt={feature.media.alt}
      sizes="(min-width: 640px) 30vw, 100vw"
      className={cn(
        // The panel absorbs whatever height the row demands, so a short card
        // never ends in an empty white gap.
        horizontal
          ? "aspect-4/3 w-full shrink-0 sm:aspect-auto sm:w-[42%]"
          : "min-h-45 w-full flex-1",
      )}
    />
  ) : null;

  return (
    <article
      className={cn(
        SHELL,
        SHELL_PLAIN,
        "gap-6",
        horizontal && "sm:flex-row sm:items-stretch",
        layout === "art-left" && "sm:flex-row-reverse",
      )}
    >
      {layout === "stack" ? (
        <>
          {media}
          {copy}
        </>
      ) : (
        <>
          {copy}
          {media}
        </>
      )}
    </article>
  );
}

export function Platform() {
  const byKey = Object.fromEntries(
    platform.features.map((feature) => [feature.key, feature]),
  ) as Record<string, PlatformFeature>;

  const AnalyticsIcon = ICONS.analytics;
  const analytics = byKey.analytics;

  const cells: Array<{ key: string; span: string; layout: CellLayout }> = [
    { key: "path", span: "lg:col-span-4", layout: "art-right" },
    { key: "tutor", span: "lg:col-span-2", layout: "stack" },
    { key: "speaking", span: "lg:col-span-2", layout: "stack" },
    { key: "vocabulary", span: "lg:col-span-4", layout: "art-left" },
    { key: "assessments", span: "lg:col-span-4", layout: "art-right" },
  ];

  return (
    <Section id="platform" aria-labelledby="platform-title">
      <Container size="wide">
        <SectionHeading
          id="platform-title"
          title={platform.title}
          lead={platform.lead}
        />

        <div className="mt-14 grid gap-4 md:gap-5 lg:grid-cols-6">
          {cells.map((cell, index) => (
            <Reveal
              key={cell.key}
              delay={staggerDelay(index)}
              className={cell.span}
            >
              <FeatureCell feature={byKey[cell.key]} layout={cell.layout} />
            </Reveal>
          ))}

          {/* The one solid accent tile in the grid. Type-forward, no artwork,
              so it reads as a statement rather than a sixth illustration. */}
          <Reveal delay={staggerDelay(5)} className="lg:col-span-2">
            <article
              className={cn(
                SHELL,
                "justify-center border-transparent bg-accent text-accent-fg",
              )}
            >
              <AnalyticsIcon size={28} weight="duotone" />
              <h3 className="mt-5 text-2xl font-semibold tracking-tight">
                {analytics.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed">{analytics.body}</p>
            </article>
          </Reveal>
        </div>
      </Container>
    </Section>
  );
}
