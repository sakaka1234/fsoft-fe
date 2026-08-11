"use client";

import { useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useInView,
  useReducedMotion,
} from "motion/react";

import { Art } from "@/components/ui/art";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { SectionHeading } from "@/components/ui/section-heading";
import { goals } from "@/content/landing";
import { cn } from "@/lib/cn";
import { EASE_OUT } from "@/lib/motion";

const SLIDE_MS = 5000;

export function Goals() {
  const [active, setActive] = useState(0);
  /** Turns off for good once the reader picks a tab themselves. */
  const [autoplay, setAutoplay] = useState(true);
  const [hovered, setHovered] = useState(false);

  const sectionRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const inView = useInView(sectionRef, { amount: 0.3 });
  const reduce = useReducedMotion();
  const current = goals.tabs[active];

  /*
    Advances every 5s. Stops while the reader is hovering or has focus inside
    the section, and while the section is off screen. Choosing a tab by hand
    ends it permanently, which is the stop mechanism WCAG 2.2.2 asks for on
    self-advancing content.
  */
  const running = autoplay && inView && !hovered;

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setActive((index) => (index + 1) % goals.tabs.length);
    }, SLIDE_MS);
    return () => window.clearInterval(id);
  }, [running]);

  function selectTab(index: number) {
    setAutoplay(false);
    setActive(index);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const offset = event.key === "ArrowRight" ? 1 : -1;
    const next = (active + offset + goals.tabs.length) % goals.tabs.length;
    selectTab(next);
    tabRefs.current[next]?.focus();
  }

  return (
    <Section id="goals" aria-labelledby="goals-title">
      <Container size="wide">
        <SectionHeading id="goals-title" title={goals.title} lead={goals.lead} />

        <div
          ref={sectionRef}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onFocusCapture={() => setHovered(true)}
          onBlurCapture={() => setHovered(false)}
        >
          <div
            role="tablist"
            aria-label="Learning goals"
            onKeyDown={onKeyDown}
            className="mt-12 flex flex-wrap gap-x-7 gap-y-3 border-b border-line"
          >
            {goals.tabs.map((tab, index) => {
              const selected = index === active;
              return (
                <button
                  key={tab.key}
                  ref={(node) => {
                    tabRefs.current[index] = node;
                  }}
                  type="button"
                  role="tab"
                  id={`goal-tab-${tab.key}`}
                  aria-selected={selected}
                  aria-controls={`goal-panel-${tab.key}`}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => selectTab(index)}
                  className={cn(
                    "relative -mb-px pb-4 text-sm font-medium transition-colors md:text-base",
                    selected ? "text-ink" : "text-muted hover:text-ink",
                  )}
                >
                  {tab.label}
                  {selected ? (
                    <motion.span
                      layoutId="goal-tab-underline"
                      aria-hidden
                      className="absolute inset-x-0 -bottom-px h-0.5 bg-accent"
                      transition={
                        // A sliding rule is travel, so it snaps instead under
                        // reduced motion. The panel still crossfades.
                        reduce
                          ? { duration: 0 }
                          : { duration: 0.35, ease: EASE_OUT }
                      }
                    />
                  ) : null}
                </button>
              );
            })}
          </div>

          <div
            role="tabpanel"
            id={`goal-panel-${current.key}`}
            aria-labelledby={`goal-tab-${current.key}`}
            aria-live="polite"
            className="mt-10"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={current.key}
                /*
                  Opacity always animates: a crossfade is the recommended
                  reduced-motion fallback, not something to strip. Only the
                  horizontal travel is dropped for readers who ask for less.
                */
                initial={{ opacity: 0, x: reduce ? 0 : 28 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: reduce ? 0 : -28 }}
                transition={{ duration: 0.4, ease: EASE_OUT }}
                className="grid items-center gap-10 lg:grid-cols-12 lg:gap-16"
              >
                <Art
                  src={current.image.src}
                  alt={current.image.alt}
                  sizes="(min-width: 1024px) 55vw, 100vw"
                  className="aspect-3/2 w-full lg:col-span-7"
                />
                <div className="lg:col-span-5">
                  <h3 className="text-2xl font-semibold tracking-tight md:text-3xl">
                    {current.label}
                  </h3>
                  <p className="mt-4 max-w-[46ch] text-base leading-relaxed text-muted md:text-lg">
                    {current.body}
                  </p>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </Container>
    </Section>
  );
}
