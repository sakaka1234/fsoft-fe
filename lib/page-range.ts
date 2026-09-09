/**
 * Page numbers to render, with ellipsis markers, always including the first,
 * the last, the current page and one neighbour either side.
 *
 * 1 of 12  -> [1, 2, "...", 12]
 * 5 of 12  -> [1, "...", 4, 5, 6, "...", 12]
 * 12 of 12 -> [1, "...", 11, 12]
 */
export function pageRange(
  page: number,
  totalPages: number,
): (number | "ellipsis")[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const items: (number | "ellipsis")[] = [1];
  const from = Math.max(2, page - 1);
  const to = Math.min(totalPages - 1, page + 1);

  if (from > 2) items.push("ellipsis");
  for (let value = from; value <= to; value++) items.push(value);
  if (to < totalPages - 1) items.push("ellipsis");
  items.push(totalPages);

  return items;
}