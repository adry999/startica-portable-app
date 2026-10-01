export type PageItem = number | 'ellipsis';

/**
 * Paginile de afișat (1-indexat): toate dacă încap în 7 poziții, altfel prima/ultima +
 * pagina curentă ± 1, cu „…” pentru goluri (COMPONENTE.md §Pagination).
 */
export function pageWindow(page: number, totalPages: number): PageItem[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }
  const shown = new Set<number>([1, totalPages]);
  for (let candidate = page - 1; candidate <= page + 1; candidate += 1) {
    if (candidate >= 1 && candidate <= totalPages) shown.add(candidate);
  }
  const sorted = Array.from(shown).sort((a, b) => a - b);
  const items: PageItem[] = [];
  let previous: number | null = null;
  for (const current of sorted) {
    if (previous !== null && current - previous > 1) items.push('ellipsis');
    items.push(current);
    previous = current;
  }
  return items;
}
