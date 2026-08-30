import type { Metadata } from "next";

import { GamesView } from "@/components/app/games-view";

export const metadata: Metadata = {
  title: "Chơi game",
};

export default function GamesPage() {
  return <GamesView />;
}
