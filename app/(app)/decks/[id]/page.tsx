import { notFound } from "next/navigation";

import { DeckDetailView } from "@/components/app/deck-detail-view";

/**
 * The id is read on the server so the client view starts with a number it can
 * trust; everything below it is client rendered because the session token
 * lives in the browser.
 */
export default async function DeckPage({ params }: PageProps<"/decks/[id]">) {
  const { id } = await params;
  const deckId = Number(id);

  if (!Number.isInteger(deckId) || deckId <= 0) notFound();

  return <DeckDetailView deckId={deckId} />;
}
