import type { Metadata } from "next";

import { CommunityView } from "@/components/app/community-view";

export const metadata: Metadata = {
  title: "Cộng đồng",
};

export default function CommunityPage() {
  return <CommunityView />;
}