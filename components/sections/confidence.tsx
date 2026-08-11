import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Reveal } from "@/components/ui/reveal";
import { confidence } from "@/content/landing";
import { cn } from "@/lib/cn";
import { staggerDelay } from "@/lib/motion";

export function Confidence() {
  return (
    <Section id="confidence" tone="tinted" aria-labelledby="confidence-title">
      <Container>
        <Reveal>
          <h2
            id="confidence-title"
            className="max-w-[20ch] text-3xl font-semibold tracking-tight text-balance sm:text-4xl md:text-[2.75rem] md:leading-[1.08]"
          >
            {confidence.title}
          </h2>
          <p className="mt-6 max-w-[62ch] text-base leading-relaxed text-muted md:text-lg">
            {confidence.body}
          </p>
        </Reveal>

        <div className="mt-14 flex flex-wrap items-baseline gap-x-6 gap-y-2">
          {confidence.cycle.map((word, index) => (
            <Reveal key={word} delay={staggerDelay(index, 0.09)}>
              <span
                className={cn(
                  "text-2xl font-semibold tracking-tight md:text-4xl",
                  index === confidence.cycle.length - 1 && "text-accent-text",
                )}
              >
                {word}
              </span>
            </Reveal>
          ))}
        </div>

        <Reveal delay={staggerDelay(2)}>
          <p className="mt-10 text-lg font-medium md:text-xl">
            {confidence.closing}
          </p>
        </Reveal>
      </Container>
    </Section>
  );
}
