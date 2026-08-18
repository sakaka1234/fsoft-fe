import type { Metadata } from "next";
import { Cormorant_Garamond, EB_Garamond, Geist_Mono } from "next/font/google";
import "./globals.css";
import { CommunityChatWidget } from "@/components/chat/community-chat-widget";

/*
  The hero is Fragonard's L'Escarpolette, 1767, French Rococo. Both faces here
  are revivals of Claude Garamond, the 16th century French punchcutter whose
  types French printing still rested on in Fragonard's century, so the page is
  set in the same tradition as the painting rather than in something merely
  old-looking.

  Both are variable fonts, so no weight array: next/font requests the full axis
  in one file, which is smaller than the three static cuts the headings need.
*/

/** Display face. High contrast and fine hairlines, the Rococo register. */
const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
});

/** Body face. Same lineage, sturdier stems, drawn to be read at length. */
const ebGaramond = EB_Garamond({
  variable: "--font-eb-garamond",
  subsets: ["latin"],
});

/** Kept for the wordmark badge and figures, where a mono is doing real work. */
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
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
      className={`${ebGaramond.variable} ${cormorant.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-full flex-col font-sans">
        {children}
        <CommunityChatWidget />
      </body>
    </html>
  );
}

