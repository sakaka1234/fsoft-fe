import type { Metadata } from "next";

import { ExploreView } from "@/components/app/explore-view";

export const metadata: Metadata = {
  title: "Public decks",
};

export default function ExplorePage() {
  return <ExploreView />;
}
