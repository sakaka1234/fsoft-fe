"use client";

import { useLayoutEffect } from "react";
import { Moon } from "@phosphor-icons/react/Moon";
import { Sun } from "@phosphor-icons/react/Sun";

export const THEME_STORAGE_KEY = "theme";

/**
 * Light and dark switch. There is no React state here on purpose: which glyph
 * shows is decided in CSS from the data-theme attribute (globals.css), so the
 * button is already correct in the server HTML and cannot disagree with the
 * page around it during hydration.
 *
 * No stored choice means the page follows prefers-color-scheme, which is what
 * a first-time reader gets.
 */
export function ThemeToggle() {
  useLayoutEffect(() => {
    // Strict Mode remounts once in development and resets the attributes React
    // manages on <html>, which drops the one the inline script wrote. Putting
    // it back before paint keeps dev matching production, where this is a no-op.
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (stored === "dark" || stored === "light") {
        document.documentElement.dataset.theme = stored;
      }
    } catch {
      // Storage can be blocked. The OS preference still applies.
    }
  }, []);

  function toggle() {
    const root = document.documentElement;
    const chosen = root.dataset.theme;
    const isDark = chosen
      ? chosen === "dark"
      : window.matchMedia("(prefers-color-scheme: dark)").matches;
    const next = isDark ? "light" : "dark";

    root.dataset.theme = next;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Choice applies for this page view only.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Switch between light and dark theme"
      title="Switch between light and dark theme"
      className="flex size-10 items-center justify-center rounded-full border border-line text-ink transition-colors hover:bg-surface-2"
    >
      <Moon aria-hidden size={17} className="theme-icon-moon" />
      <Sun aria-hidden size={17} className="theme-icon-sun" />
    </button>
  );
}
