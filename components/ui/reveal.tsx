"use client";

import { motion, useReducedMotion } from "motion/react";
import { EASE_OUT, REVEAL_DURATION } from "@/lib/motion";

type RevealProps = {
  children: React.ReactNode;
  /** Seconds. Use `staggerDelay(index)` for grouped items. */
  delay?: number;
  /** Travel distance in px. 0 gives a pure fade. */
  y?: number;
  className?: string;
  as?: "div" | "li";
};

/**
 * Entry reveal for content arriving in the viewport. Communicates reading
 * order: a section's heading settles before its items do.
 * Collapses to a static render under prefers-reduced-motion.
 */
export function Reveal({
  children,
  delay = 0,
  y = 18,
  className,
  as = "div",
}: RevealProps) {
  const reduce = useReducedMotion();
  const Component = as === "li" ? motion.li : motion.div;

  return (
    <Component
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: REVEAL_DURATION, delay, ease: EASE_OUT }}
    >
      {children}
    </Component>
  );
}
