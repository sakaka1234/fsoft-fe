import type { Metadata } from "next";

import { AiStudioView } from "@/components/app/ai-studio-view";

export const metadata: Metadata = {
  title: "Agent User",
};

export default function AiStudioPage() {
  return <AiStudioView />;
}
