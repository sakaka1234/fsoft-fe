"use client";

import { useState } from "react";
import { Pause } from "@phosphor-icons/react/Pause";
import { Play } from "@phosphor-icons/react/Play";

import { cn } from "@/lib/cn";

type WordMarqueeProps = {
  words: readonly string[];
  /** Seconds for one full pass of the belt. Lower is faster. */
  duration?: number;
};

const ROW = "flex shrink-0 items-baseline gap-10 pr-10";

function wordClass(index: number) {
  return cn(
    "text-3xl font-semibold tracking-tight whitespace-nowrap md:text-5xl",
    index % 3 === 1 ? "text-accent-text" : "text-muted",
  );
}

function Row({
  words,
  duplicate = false,
}: {
  words: readonly string[];
  duplicate?: boolean;
}) {
  return (
    <ul aria-hidden={duplicate || undefined} className={ROW}>
      {words.map((word, index) => (
        <li key={word} className={wordClass(index)}>
          {word}
        </li>
      ))}
    </ul>
  );
}

/**
 * Continuous word belt. The track holds the list twice and shifts by exactly
 * -50%, so the second copy lands where the first started and the loop has no
 * seam. Transform only, driven by CSS, so it costs no main thread work.
 *
 * Motion policy, decided deliberately: this belt always starts running, even
 * for readers who ask for reduced motion. That is a documented exception to
 * the page-wide rule, made on the product owner's call because the belt is the
 * section's whole point. What keeps it honest is the pause control below:
 * WCAG 2.2.2 asks that self-starting motion can be stopped, not that it never
 * starts, so the button is the accessibility mechanism here and is not
 * optional. Everything else on the page (hero drift, scroll reveals, tab and
 * accordion transitions) still collapses under prefers-reduced-motion.
 */
export function WordMarquee({ words, duration = 30 }: WordMarqueeProps) {
  const [playing, setPlaying] = useState(true);

  return (
    <div className="relative">
      <div className="marquee overflow-hidden">
        <div
          className="marquee-track flex w-max"
          style={
            {
              "--marquee-duration": `${duration}s`,
              animationPlayState: playing ? "running" : "paused",
            } as React.CSSProperties
          }
        >
          <Row words={words} />
          <Row words={words} duplicate />
        </div>
      </div>

      <button
        type="button"
        onClick={() => setPlaying((value) => !value)}
        aria-pressed={!playing}
        aria-label={playing ? "Pause the word belt" : "Play the word belt"}
        className="absolute top-1/2 right-4 flex size-9 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-surface text-ink transition-colors hover:bg-surface-2 sm:right-6"
      >
        {playing ? <Pause size={14} weight="fill" /> : <Play size={14} weight="fill" />}
      </button>
    </div>
  );
}
