import { Art } from "@/components/ui/art";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { SectionHeading } from "@/components/ui/section-heading";
import { Reveal } from "@/components/ui/reveal";
import { speaking } from "@/content/landing";
import { staggerDelay } from "@/lib/motion";

export function Speaking() {
  return (
    <Section id="speaking" aria-labelledby="speaking-title">
      <Container size="wide">
        <SectionHeading
          id="speaking-title"
          title={speaking.title}
          lead={speaking.lead}
        />

        {/* Horizontal scroll-snap: the partially visible fourth card is the
            affordance, so the section needs no scroll label. */}
        <div
          role="region"
          aria-label="Conversation scenarios, scroll horizontally"
          tabIndex={0}
          className="mt-14 -mx-5 snap-x snap-mandatory overflow-x-auto pb-4 sm:-mx-8"
        >
          <ul className="flex w-max gap-5 px-5 sm:px-8">
            {speaking.scenarios.map((scenario, index) => (
              <Reveal
                as="li"
                key={scenario.key}
                delay={staggerDelay(index)}
                className="w-68 shrink-0 snap-start sm:w-83 lg:w-92"
              >
                <article className="card-lift flex h-full flex-col gap-5 rounded-card border border-line bg-surface p-5">
                  <Art
                    src={scenario.image.src}
                    alt={scenario.image.alt}
                    sizes="(min-width: 1024px) 368px, 70vw"
                    className="aspect-4/3 w-full"
                  />
                  <div>
                    <h3 className="text-lg font-semibold tracking-tight">
                      {scenario.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted">
                      {scenario.body}
                    </p>
                  </div>
                </article>
              </Reveal>
            ))}
          </ul>
        </div>
      </Container>
    </Section>
  );
}
