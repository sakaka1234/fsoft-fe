import { Art } from "@/components/ui/art";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { ButtonLink } from "@/components/ui/button-link";
import { Reveal } from "@/components/ui/reveal";
import { finalCta } from "@/content/landing";
import { primaryCta } from "@/content/site";

export function FinalCta() {
  return (
    <Section id="start" aria-labelledby="start-title">
      <Container>
        <Reveal>
          {/* The one centred composition on the page: the message is the layout. */}
          <div className="flex flex-col items-center rounded-card border border-line bg-[radial-gradient(90%_140%_at_50%_0%,var(--accent-soft),transparent_65%)] px-6 py-14 text-center md:px-12 md:py-20">
            <Art
              src={finalCta.image.src}
              alt={finalCta.image.alt}
              float
              floatDelay={0.6}
              sizes="(min-width: 768px) 260px, 60vw"
              className="mb-10 aspect-square w-52 md:w-64"
            />
            <h2
              id="start-title"
              className="max-w-[18ch] text-3xl font-semibold tracking-tight text-balance sm:text-4xl md:text-5xl"
            >
              {finalCta.title}
            </h2>
            <p className="mt-5 max-w-[50ch] text-base leading-relaxed text-muted md:text-lg">
              {finalCta.body}
            </p>
            <ButtonLink href={primaryCta.href} size="lg" className="mt-9">
              {primaryCta.label}
            </ButtonLink>
            <p className="mt-4 text-sm text-muted">{finalCta.note}</p>
          </div>
        </Reveal>
      </Container>
    </Section>
  );
}
