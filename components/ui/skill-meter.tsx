"use client";

import { motion, useReducedMotion } from "motion/react";
import { EASE_OUT } from "@/lib/motion";

/**
 * The measured value drawn as a single accent rule, no background track.
 * Transform only (scaleX from the left edge), so it stays off the layout path.
 * The number itself is rendered as text next to it, which is what screen
 * readers announce, so the rule is decorative.
 */
export function SkillMeter({ value, delay = 0 }: { value: number; delay?: number }) {
  const reduce = useReducedMotion();

  return (
    <div aria-hidden className="mt-5 h-0.5" style={{ width: `${value}%` }}>
      <motion.div
        className="h-full origin-left rounded-full bg-accent"
        initial={reduce ? false : { scaleX: 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={{ once: true, amount: 0.6 }}
        transition={{ duration: 0.9, delay, ease: EASE_OUT }}
      />
    </div>
  );
}
