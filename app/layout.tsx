import type { Metadata } from "next";
import { Geist, Geist_Mono, Outfit } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/** Display face for headings. Rounder and friendlier next to the artwork. */
const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "AI EMS - Learn English smarter. Speak with confidence.",
    template: "%s | AI EMS",
  },
  description:
    "An AI English platform that reads your level, adapts to your goals, and builds real speaking skills faster.",
  openGraph: {
    title: "AI English Management System",
    description:
      "Personalized learning paths, an AI tutor, speaking practice, and analytics across every English skill.",
    type: "website",
  },
};

/*
  Applies a stored theme choice while the browser is still parsing the HTML,
  so the page paints in the right theme once instead of flashing light first.
  Anything heavier belongs in a component: this runs before React exists.
  No stored value leaves the attribute off, which hands the decision back to
  prefers-color-scheme (see app/globals.css).
*/
const themeScript = `(function(){try{var t=localStorage.getItem("theme");if(t==="dark"||t==="light")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${outfit.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
