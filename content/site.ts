/**
 * Brand level copy and navigation. One label per CTA intent for the whole
 * site: every signup action says "Start learning free", nothing else.
 */
export const site = {
  name: "AI EMS",
  fullName: "AI English Management System",
  tagline: "Learn English smarter. Speak with confidence.",
  copyright: "© 2026 AI English Management System. All rights reserved.",
} as const;

/** Every signup action on the site uses this one label and target. */
export const primaryCta = {
  label: "Start learning free",
  href: "/register",
} as const;

export const signInCta = {
  label: "Log in",
  href: "/login",
} as const;

export const navItems = [
  { label: "Platform", href: "#platform" },
  { label: "Speaking", href: "#speaking" },
  { label: "Progress", href: "#progress" },
  { label: "How it works", href: "#path" },
  { label: "FAQ", href: "#faq" },
] as const;

export const footerColumns = [
  {
    title: "Learn",
    links: [
      { label: "Platform", href: "#platform" },
      { label: "AI tutor", href: "#tutor" },
      { label: "Speaking practice", href: "#speaking" },
      { label: "Vocabulary", href: "#vocabulary" },
    ],
  },
  {
    title: "Your progress",
    links: [
      { label: "Skill tracking", href: "#progress" },
      { label: "Learning path", href: "#path" },
      { label: "Goals", href: "#goals" },
    ],
  },
  {
    title: "About",
    links: [
      { label: "Frequently asked questions", href: "#faq" },
      { label: "Start learning free", href: "/register" },
      { label: "Log in", href: "/login" },
    ],
  },
] as const;
