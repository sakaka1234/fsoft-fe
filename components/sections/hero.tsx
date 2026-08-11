import { Art } from "@/components/ui/art";
import { Container } from "@/components/ui/container";
import { ButtonLink } from "@/components/ui/button-link";
import { Reveal } from "@/components/ui/reveal";
import { hero } from "@/content/landing";
import { primaryCta } from "@/content/site";
import { staggerDelay } from "@/lib/motion";

export function Hero() {
  return (
    <section id="top" aria-labelledby="hero-title">
      <Container size="wide">
        <div className="grid items-center gap-14 pt-12 pb-20 md:pt-20 md:pb-24 lg:min-h-[calc(100dvh-68px)] lg:grid-cols-12 lg:gap-16 lg:pb-20">
          <div className="lg:col-span-7">
            <Reveal>
              <h1
                id="hero-title"
                className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-[3.25rem] lg:leading-[1.05]"
              >
                {hero.titleLead}
                <br className="hidden sm:block" />{" "}
                <span className="text-accent-text">{hero.titleAccent}</span>{" "}
                {hero.titleTail}
              </h1>
            </Reveal>

            <Reveal delay={staggerDelay(1)}>
              <p className="mt-6 max-w-[46ch] text-lg leading-relaxed text-muted">
                {hero.subtext}
              </p>
            </Reveal>

            <Reveal delay={staggerDelay(2)}>
              <div className="mt-9 flex flex-wrap items-center gap-3">
                <ButtonLink href={primaryCta.href} size="lg">
                  {primaryCta.label}
                </ButtonLink>
                <ButtonLink
                  href={hero.secondaryCta.href}
                  variant="secondary"
                  size="lg"
                >
                  {hero.secondaryCta.label}
                </ButtonLink>
              </div>
            </Reveal>
          </div>

          <Reveal delay={staggerDelay(2)} y={26} className="lg:col-span-5">
            <div className="relative">
              <div
                aria-hidden
                className="absolute inset-0 translate-x-4 translate-y-4 rounded-card bg-accent-soft"
              />
              <Art
                src={hero.image.src}
                alt={hero.image.alt}
                float
                priority
                sizes="(min-width: 1024px) 40vw, 100vw"
                className="relative aspect-square"
              />
            </div>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
