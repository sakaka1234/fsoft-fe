import { Container } from "@/components/ui/container";
import { HeroScene } from "@/components/sections/hero-scene";
import { ButtonLink } from "@/components/ui/button-link";
import { Reveal } from "@/components/ui/reveal";
import { hero } from "@/content/landing";
import { primaryCta } from "@/content/site";
import { staggerDelay } from "@/lib/motion";

/**
 * Full-bleed 3D scene with the copy laid over it.
 *
 * The negative top margin pulls the section up under the header, which is
 * sticky and translucent (bg-paper/85 + backdrop-blur), so the scene runs the
 * full height of the viewport and shows through the chrome instead of starting
 * below it. The copy is padded back down to clear the header.
 *
 * Stacking is document order, not z-index: the scene, then a relative
 * Container. Only the header carries a z-index on this page and it stays above
 * both.
 *
 * hero-dark makes this section a dark island in both themes, because the scene
 * behind the copy is a near-black painting either way. See globals.css. The
 * edge where it meets the next section stays hard on purpose: a band of dark
 * that ends is a deliberate break, a band that fades out looks like a bug.
 *
 * The copy sits straight on the scene with nothing laid between them. That is
 * the requested look, and it does mean the scene's own left side is the only
 * thing carrying the contrast: republishing it lighter in Spline is now enough
 * to make the headline hard to read, with nothing in this repo to catch it.
 */
export function Hero() {
  return (
    <section
      id="top"
      aria-labelledby="hero-title"
      className="hero-dark relative -mt-16 flex min-h-dvh items-center overflow-hidden md:-mt-17"
    >
      <div aria-hidden className="absolute inset-0">
        <HeroScene scene={hero.scene} />
      </div>

      <Container size="wide" className="relative pt-28 pb-20 md:pt-32 md:pb-24">
        <div className="max-w-xl lg:max-w-2xl">
          <Reveal>
            <h1
              id="hero-title"
              /* Bolder and larger than the old sans set it: Cormorant carries a
                 much smaller x-height, so it reads roughly a sixth smaller at
                 the same font-size, and its hairlines need the extra stem
                 weight to hold against a busy painting rather than dissolve
                 into it. */
              className="text-5xl font-bold text-balance sm:text-6xl lg:text-[4rem] lg:leading-[1.02]"
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
      </Container>
    </section>
  );
}
