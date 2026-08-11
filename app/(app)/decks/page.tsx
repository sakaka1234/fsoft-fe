import type { Metadata } from "next";

import { DecksView } from "@/components/app/decks-view";

export const metadata: Metadata = {
  title: "Your decks",
};

export default function DecksPage() {
  return <DecksView />;
}
