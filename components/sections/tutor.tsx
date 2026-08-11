import { ArrowRight } from "@phosphor-icons/react/dist/ssr/ArrowRight";
import { ChatsCircle } from "@phosphor-icons/react/dist/ssr/ChatsCircle";

import { Art } from "@/components/ui/art";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Reveal } from "@/components/ui/reveal";
import { tutor } from "@/content/landing";
import { cn } from "@/lib/cn";
import { staggerDelay } from "@/lib/motion";

export function Tutor() {
  return (
    <Section id="tutor" tone="tinted" aria-labelledby="tutor-title">
      <Container size="wide">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-5">
            <Reveal>
              <h2
                id="tutor-title"
                className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl md:text-[2.75rem] md:leading-[1.08]"
              >
                {tutor.title}
              </h2>
              <p className="mt-5 max-w-[46ch] text-base leading-relaxed text-muted md:text-lg">
                {tutor.lead}
              </p>
              <p className="mt-8 max-w-[42ch] text-xl leading-snug font-medium text-ink">
                {tutor.closing}
              </p>
              <a
                href={tutor.link.href}
                className="group mt-8 inline-flex items-center gap-2 text-sm font-medium text-accent-text"
              >
                {tutor.link.label}
                <ArrowRight
                  size={16}
                  className="transition-transform duration-200 group-hover:translate-x-1 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
                />
              </a>
            </Reveal>

            <Reveal delay={staggerDelay(1)}>
              <Art
                src={tutor.image.src}
                alt={tutor.image.alt}
                float
                floatDelay={1.2}
                sizes="(min-width: 1024px) 32vw, 70vw"
                className="mt-10 aspect-square max-w-xs"
              />
            </Reveal>
          </div>

          <div className="lg:col-span-7">
            <Reveal>
              <h3 className="text-sm font-medium text-muted">
                {tutor.promptsTitle}
              </h3>
            </Reveal>
            <ul className="mt-6 flex flex-col gap-4">
              {tutor.prompts.map((prompt, index) => (
                <Reveal as="li" key={prompt} delay={staggerDelay(index + 1)}>
                  <div
                    className={cn(
                      "flex items-start gap-4 rounded-card border border-line bg-surface p-5 md:p-6",
                      // Slight offsets keep the stack from reading as a table.
                      index % 2 === 1 && "lg:ml-10",
                      index === 3 && "lg:ml-16",
                    )}
                  >
                    <ChatsCircle
                      size={22}
                      weight="duotone"
                      className="mt-0.5 shrink-0 text-accent-text"
                    />
                    <p className="text-base leading-snug text-ink md:text-lg">
                      {prompt}
                    </p>
                  </div>
                </Reveal>
              ))}
            </ul>
          </div>
        </div>
      </Container>
    </Section>
  );
}
