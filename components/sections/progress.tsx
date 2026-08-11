import { Target } from "@phosphor-icons/react/dist/ssr/Target";

import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { SectionHeading } from "@/components/ui/section-heading";
import { Reveal } from "@/components/ui/reveal";
import { SkillMeter } from "@/components/ui/skill-meter";
import { progress } from "@/content/landing";
import { staggerDelay } from "@/lib/motion";

export function Progress() {
  return (
    <Section id="progress" tone="tinted" aria-labelledby="progress-title">
      <Container size="wide">
        <SectionHeading
          id="progress-title"
          title={progress.title}
          lead={progress.lead}
        />

        <ul className="mt-14 grid gap-x-10 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
          {progress.skills.map((skill, index) => (
            <Reveal as="li" key={skill.label} delay={staggerDelay(index)}>
              <div className="border-t border-line pt-5">
                <div className="flex items-baseline justify-between gap-4">
                  <h3 className="text-base font-medium">{skill.label}</h3>
                  <p className="font-mono text-2xl tracking-tight tabular-nums">
                    {skill.value}
                    <span className="text-muted">%</span>
                  </p>
                </div>
                <SkillMeter value={skill.value} delay={staggerDelay(index)} />
              </div>
            </Reveal>
          ))}
        </ul>

        <Reveal delay={staggerDelay(2)}>
          <div className="mt-14 rounded-card border border-line bg-surface p-7 md:p-9">
            <dl className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {progress.snapshot.map((item) => (
                <div key={item.label} className="flex flex-col gap-1.5">
                  <dt className="text-sm text-muted">{item.label}</dt>
                  <dd className="font-mono text-2xl tracking-tight tabular-nums">
                    {item.value}
                  </dd>
                  <dd className="text-sm text-muted">{item.unit}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line pt-7">
              <Target size={20} weight="duotone" className="text-accent-text" />
              <p className="text-sm text-muted">{progress.recommendation.label}</p>
              <p className="text-base font-medium text-ink">
                {progress.recommendation.value}
              </p>
            </div>
          </div>
          <p className="mt-4 text-sm text-muted">{progress.caption}</p>
        </Reveal>
      </Container>
    </Section>
  );
}
