import { escapeHtml } from './html-escape.mjs';

/** @typedef {import('#shared/contracts/record-types.mjs').Child} Child */

/** @param {Pick<Child, 'parent' | 'phone' | 'parent2' | 'phone2'>} child */
export function formatParentContacts(child) {
  return (
    [
      [child.parent, child.phone],
      [child.parent2, child.phone2],
    ]
      .filter(pair => pair.some(Boolean))
      .map(([name, phone]) => `${escapeHtml(name || 'Nume necompletat')}${phone ? '<br>' + escapeHtml(phone) : ''}`)
      .join('<br>') || 'Necompletat'
  );
}
