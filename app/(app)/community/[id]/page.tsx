import type { Metadata } from "next";

import { CommunityPostDetailView } from "@/components/app/community-post-detail-view";

export const metadata: Metadata = {
  title: "Bài viết",
};

export default async function CommunityPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CommunityPostDetailView postId={Number(id)} />;
}