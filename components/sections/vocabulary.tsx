import { Check } from "@phosphor-icons/react/dist/ssr/Check";

import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { SectionHeading } from "@/components/ui/section-heading";
import { Reveal } from "@/components/ui/reveal";
import { WordMarquee } from "@/components/ui/word-marquee";
import { vocabulary } from "@/content/landing";
import { staggerDelay } from "@/lib/motion";

export function Vocabulary() {
  return (
    <Section id="vocabulary" aria-labelledby="vocabulary-title">
      <Container size="wide">
        <SectionHeading
          id="vocabulary-title"
          title={vocabulary.title}
          lead={vocabulary.lead}
        />
      </Container>

      {/* The one marquee on the page. It carries the breadth of the word bank,
          which a static list of five words cannot show. */}
      <div className="mt-14 border-y border-line py-7">
        <WordMarquee words={vocabulary.words} />
      </div>

      <Container size="wide">
        <div className="mt-14 grid gap-10 lg:grid-cols-12 lg:gap-16">
          <Reveal className="lg:col-span-5">
            <p className="text-2xl leading-tight font-semibold tracking-tight text-balance md:text-3xl">
              {vocabulary.statement.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </p>
          </Reveal>

          <ul className="flex flex-wrap gap-3 lg:col-span-7 lg:content-start">
            {vocabulary.habits.map((habit, index) => (
              <Reveal as="li" key={habit} delay={staggerDelay(index)}>
                <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2.5 text-sm text-ink">
                  <Check size={15} weight="bold" className="text-accent-text" />
                  {habit}
                </span>
              </Reveal>
            ))}
          </ul>
        </div>
      </Container>
    </Section>
  );
}
