/** @typedef {import('#shared/contracts/record-types.mjs').RecordsSnapshot} RecordsSnapshot */
/** @typedef {{ items: Array<{ type: string, record: { archived?: boolean }, id: string }> }} ReviewCenterLike */

/**
 * Statisticile de sub bara de titlu de pe ecranul „Copii” (copii activi,
 * grupe ocupate, fișe incomplete).
 * @param {{
 *   elements: { activeChildren: HTMLElement, occupiedGroups: HTMLElement, incompleteChildren: HTMLElement },
 *   readRecords: () => RecordsSnapshot,
 * }} dependencies
 * @returns {(context: { review: ReviewCenterLike }) => void}
 */
export function createChildrenSummaryView({
  elements: { activeChildren, occupiedGroups, incompleteChildren },
  readRecords,
}) {
  return function renderChildrenSummary({ review }) {
    const children = readRecords().children.filter(c => !c.archived);
    const active = children.filter(c => c.status === 'Activ').length;
    const occupied = new Set(children.map(c => c.groupId).filter(Boolean)).size;
    // Centrul grupează deja observațiile după tip și ID; Set-ul păstrează
    // protecția explicită dacă regulile de verificare se extind ulterior.
    const incomplete = new Set(
      review.items.filter(item => item.type === 'children' && !item.record.archived).map(item => item.id),
    ).size;
    activeChildren.textContent = String(active);
    occupiedGroups.textContent = String(occupied);
    incompleteChildren.textContent = String(incomplete);
  };
}
