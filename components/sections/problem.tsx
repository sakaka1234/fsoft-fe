import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { SectionHeading } from "@/components/ui/section-heading";
import { Reveal } from "@/components/ui/reveal";
import { problem } from "@/content/landing";
import { staggerDelay } from "@/lib/motion";

export function Problem() {
  return (
    <Section id="problem" tone="tinted" aria-labelledby="problem-title">
      <Container>
        <SectionHeading
          id="problem-title"
          title={problem.title}
          lead={problem.lead}
        />

        <ul className="mt-14 grid gap-x-12 gap-y-8 sm:grid-cols-2">
          {problem.pains.map((pain, index) => (
            <Reveal as="li" key={pain} delay={staggerDelay(index)}>
              <p className="border-t border-line pt-6 pr-4 text-xl leading-snug text-ink sm:text-[1.375rem]">
                {pain}
              </p>
            </Reveal>
          ))}
        </ul>

        <Reveal delay={staggerDelay(2)}>
          <div className="mt-14 rounded-card bg-accent-soft p-8 md:p-12">
            <h3 className="text-2xl font-semibold tracking-tight md:text-3xl">
              {problem.answerTitle}
            </h3>
            <p className="mt-4 max-w-[62ch] text-base leading-relaxed text-muted md:text-lg">
              {problem.answerBody}
            </p>
          </div>
        </Reveal>
      </Container>
    </Section>
  );
}
