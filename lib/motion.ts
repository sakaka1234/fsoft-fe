/**
 * Shared motion constants so every animated leaf on the page uses the same
 * curve and timing. MOTION_INTENSITY sits at 6: entry reveals, scroll-linked
 * progress, and state transitions. No scroll hijacking, no infinite loops
 * outside of the single vocabulary marquee.
 */
export const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

export const REVEAL_DURATION = 0.6;

/** Delay for the nth item in a staggered group. */
export function staggerDelay(index: number, step = 0.07): number {
  return index * step;
}
