"use client";

import { Button } from "@/components/ui/button";
import { GOOGLE_CLIENT_ID, googleAuthorizeUrl } from "@/lib/auth/google";

/**
 * Full page redirect rather than a popup: the backend expects the code to come
 * back on the registered redirect URI, and popups get blocked often enough to
 * be a worse default.
 *
 * Renders nothing when the client id is missing, because a button that always
 * fails is worse than no button. Set NEXT_PUBLIC_GOOGLE_CLIENT_ID to enable it.
 */
export function GoogleButton({ label }: { label: string }) {
  if (!GOOGLE_CLIENT_ID) return null;

  return (
    <div className="flex flex-col gap-5">
      <Button
        type="button"
        variant="secondary"
        size="lg"
        onClick={() => {
          window.location.href = googleAuthorizeUrl();
        }}
        className="w-full"
      >
        <GoogleMark />
        {label}
      </Button>

      <div className="flex items-center gap-4">
        <span className="h-px flex-1 bg-line" />
        <span className="text-sm text-muted">or</span>
        <span className="h-px flex-1 bg-line" />
      </div>
    </div>
  );
}

/**
 * Google's mark is a brand asset with fixed colors, so it cannot come from the
 * icon set and cannot take the page's accent. This is the official four color
 * "G", inlined so it works offline and in both themes.
 */
function GoogleMark() {
  return (
    <svg aria-hidden width="17" height="17" viewBox="0 0 48 48">
      <path
        fill="#4285F4"
        d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
      />
      <path
        fill="#34A853"
        d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
      />
      <path
        fill="#FBBC05"
        d="M11.69 28.18c-.44-1.32-.69-2.73-.69-4.18s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z"
      />
      <path
        fill="#EA4335"
        d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
      />
    </svg>
  );
}
