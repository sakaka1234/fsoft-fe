"use client";

import { useRef } from "react";
import { motion, useReducedMotion, useScroll } from "motion/react";

import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { SectionHeading } from "@/components/ui/section-heading";
import { Reveal } from "@/components/ui/reveal";
import { path } from "@/content/landing";
import { staggerDelay } from "@/lib/motion";

/**
 * The rail fills as the reader moves through the five steps, so the section
 * reads as one journey rather than five unrelated blocks. Scroll progress
 * drives a motion value, never React state, so nothing re-renders on scroll.
 */
export function Path() {
  const trackRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: trackRef,
    offset: ["start 0.75", "end 0.6"],
  });

  return (
    <Section id="path" tone="tinted" aria-labelledby="path-title">
      <Container>
        <SectionHeading id="path-title" title={path.title} lead={path.lead} />

        <div ref={trackRef} className="relative mt-14 pl-8 md:mt-16 md:pl-14">
          <div
            aria-hidden
            className="absolute top-2 bottom-2 left-0 w-px bg-line"
          />
          <motion.div
            aria-hidden
            className="absolute top-2 bottom-2 left-0 w-px origin-top bg-accent"
            style={reduce ? undefined : { scaleY: scrollYProgress }}
          />

          <ol className="flex flex-col gap-12 md:gap-16">
            {path.steps.map((step, index) => (
              <Reveal as="li" key={step.key} delay={staggerDelay(index, 0.05)}>
                <h3 className="text-2xl font-semibold tracking-tight md:text-3xl">
                  {step.title}
                </h3>
                <p className="mt-3 max-w-[56ch] text-base leading-relaxed text-muted md:text-lg">
                  {step.body}
                </p>
              </Reveal>
            ))}
          </ol>
        </div>
      </Container>
    </Section>
  );
}
