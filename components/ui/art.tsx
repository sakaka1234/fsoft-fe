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
 * Illustration panel. The artwork is SVG from public/illustrations/, so it is
 * served unoptimized (Next skips the optimizer for .svg anyway) and always
 * sits on the light --art-bg surface in both themes, which is why the accent
 * baked into the files is the light-theme one.
 *
 * width/height are a layout hint only. The panel carries its own aspect class
 * at each call site and object-contain fits the file inside it, so the source
 * files do not need to share one aspect ratio.
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
