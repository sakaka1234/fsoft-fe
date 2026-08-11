"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "motion/react";

import { cn } from "@/lib/cn";

type ArtProps = {
  src: string;
  alt: string;
  /** Gentle vertical drift. Reserved for the two hero-scale illustrations. */
  float?: boolean;
  /** Seconds of offset so two floating figures do not move in lockstep. */
  floatDelay?: number;
  className?: string;
  padded?: boolean;
  priority?: boolean;
  sizes?: string;
};

/**
 * Illustration panel. The artwork is 960x960 line-art SVG, so it is served
 * unoptimized (nothing for the image optimizer to do) and always sits on the
 * light --art-bg surface, in both themes, so the black linework stays visible.
 */
export function Art({
  src,
  alt,
  float = false,
  floatDelay = 0,
  className,
  padded = true,
  priority = false,
  sizes,
}: ArtProps) {
  const reduce = useReducedMotion();
  const animate =
    float && !reduce ? { y: [0, -14, 0] } : { y: 0 };

  return (
    <div
      className={cn(
        "flex items-center justify-center overflow-hidden rounded-card bg-art",
        padded && "p-6 sm:p-8",
        className,
      )}
    >
      <motion.div
        className="flex h-full w-full items-center justify-center"
        animate={animate}
        transition={{
          duration: 7,
          delay: floatDelay,
          repeat: float && !reduce ? Infinity : 0,
          ease: "easeInOut",
        }}
      >
        <Image
          src={src}
          alt={alt}
          width={960}
          height={960}
          unoptimized
          priority={priority}
          sizes={sizes}
          className="h-auto max-h-full w-full object-contain"
        />
      </motion.div>
    </div>
  );
}
