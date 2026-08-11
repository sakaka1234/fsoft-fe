import { Hero } from "@/components/sections/hero";
import { Problem } from "@/components/sections/problem";
import { Platform } from "@/components/sections/platform";
import { Tutor } from "@/components/sections/tutor";
import { Speaking } from "@/components/sections/speaking";
import { Progress } from "@/components/sections/progress";
import { Vocabulary } from "@/components/sections/vocabulary";
import { Path } from "@/components/sections/path";
import { Goals } from "@/components/sections/goals";
import { Confidence } from "@/components/sections/confidence";
import { FinalCta } from "@/components/sections/final-cta";
import { Faq } from "@/components/sections/faq";

/**
 * Landing page composition. Each section owns its own layout family and the
 * tone alternates paper / tinted so the page reads as one document.
 */
export default function LandingPage() {
  return (
    <>
      <Hero />
      <Problem />
      <Platform />
      <Tutor />
      <Speaking />
      <Progress />
      <Vocabulary />
      <Path />
      <Goals />
      <Confidence />
      <FinalCta />
      <Faq />
    </>
  );
}
