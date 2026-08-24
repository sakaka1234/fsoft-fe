import type { Metadata } from "next";

import { AiSearchView } from "@/components/app/ai-search-view";

export const metadata: Metadata = {
  title: "Tra từ",
};

export default function SearchPage() {
  return <AiSearchView />;
}
