import type { Metadata } from "next";
import { DecksView } from "@/components/app/decks-view";

export const metadata: Metadata = {
  title: "Ôn tập từ vựng (FSRS)",
};

export default function SrsPage() {
  return <DecksView defaultTab="srs" />;
}
