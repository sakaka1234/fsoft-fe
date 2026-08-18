"use client";

import { useCallback, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import type { Application } from "@splinetool/runtime";

import { ErrorBoundary } from "@/components/ui/error-boundary";
import { cn } from "@/lib/cn";

/**
 * Loaded on demand, and this is not optional. @splinetool/runtime ships a
 * 2MB eager chunk; a static import puts all of it in the landing page's
 * first load (measured: 2,717,613B static vs 679,310B dynamic, ~559KB gzip
 * of difference). A static import is fetched whether or not the component
 * ends up rendering, so no runtime branch can undo it.
 *
 * ssr:false is legal here only because this file is a client component. In
 * hero.tsx, a Server Component, it is a hard build error
 * (node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md).
 *
 * Not the @splinetool/react-spline/next entry: that is an async Server
 * Component whose whole job is to fetch <host>/<id>/hash and build a blurhash
 * preview. This scene returns `{}` from that endpoint, so it renders no
 * preview at all while importing react-spline statically, which costs the 2MB
 * above for nothing.
 *
 * loading renders nothing on purpose. This scene is full-bleed behind the hero
 * copy, so any placeholder surface here would be a slab of colour under the
 * headline. The page background is already the right answer.
 */
const Spline = dynamic(() => import("@splinetool/react-spline"), {
  ssr: false,
  loading: () => null,
});

type HeroSceneProps = {
  /** Spline scene URL, the .splinecode published from the editor. */
  scene: string;
  className?: string;
};

/**
 * The 3D hero scene. Fills whatever box the caller gives it.
 *
 * On prefers-reduced-motion this scene still plays, which is a deliberate
 * exception and the second one on this page after the vocabulary marquee.
 *
 * The usual accommodation, freezing on the first painted frame, cannot work
 * here: the scene opens on black and reveals itself over its intro animation,
 * so frame one is a black rectangle. Application.stop() sets _isPaused, and
 * the runtime's render() returns early on that flag before it reaches the
 * animation system, so a stopped scene never advances past whatever it had
 * drawn. The honest options for an authored intro are to play it or to leave
 * it out, and a full-bleed hero that renders as a black viewport is not a
 * degraded experience, it is a broken one.
 *
 * Two things about @splinetool/react-spline drove the rest, both read out of
 * its dist source rather than assumed:
 *
 * 1. There is no onError prop. A failed load throws during render
 *    (`if (i) throw i`), hence the ErrorBoundary. A decorative canvas going
 *    down should cost the reader the canvas, not the page. It falls back to
 *    nothing, which leaves the hero as plain copy on --paper: exactly how it
 *    read before this scene existed.
 * 2. renderMode defaults to "auto", which keeps a continuous rAF loop alive
 *    for as long as the scene animates. That is correct while the hero is on
 *    screen and pure waste once it is not, so stop()/play() follow visibility.
 *    The hero starts at the top of the document, so the observer's first
 *    callback is always intersecting and never stops a scene that is still
 *    playing its intro.
 */
export function HeroScene({ scene, className }: HeroSceneProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);

  const handleLoad = useCallback((app: Application) => {
    appRef.current = app;
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const observer = new IntersectionObserver(([entry]) => {
      const app = appRef.current;
      /* Nothing to pause until the scene has loaded. If it lands while the
         hero is already scrolled past, it renders until the next crossing,
         which is a far cheaper miss than stopping a scene mid-intro. */
      if (!app) return;
      if (entry.isIntersecting) app.play();
      else app.stop();
    });

    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={hostRef}
      className={cn("size-full [&_canvas]:size-full", className)}
    >
      <ErrorBoundary fallback={null}>
        <Spline
          scene={scene}
          onLoad={handleLoad}
          style={{ width: "100%", height: "100%" }}
        />
      </ErrorBoundary>
    </div>
  );
}
