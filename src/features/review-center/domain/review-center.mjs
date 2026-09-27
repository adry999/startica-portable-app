import { findRecordIssues } from './record-issues.mjs';

/** @typedef {import('#shared/contracts/record-types.mjs').RecordsSnapshot} RecordsSnapshot */
/** @typedef {import('../review-center.types.mjs').ReviewFilter} ReviewFilter */
/** @typedef {import('../review-center.types.mjs').ReviewCenter} ReviewCenter */

/** @type {ReviewFilter[]} */
export const REVIEW_FILTERS = [
  ['all', 'Toate problemele'],
  ['unassigned', 'Achitări fără copil'],
  ['duplicate', 'Posibile dubluri'],
  ['provisional', 'Sume mixte / provizorii'],
  ['automatic', 'Potriviri automate'],
  ['advance', 'Avans nerepartizat'],
  ['children', 'Fișe copii'],
];
const labels = Object.fromEntries(REVIEW_FILTERS);
const normalize = value => String(value || '').toLocaleLowerCase('ro-RO');
function category(issue, record) {
  const text = normalize(issue.reason + ' ' + record?.verification + ' ' + record?.notes + ' ' + record?.method);
  if (issue.type === 'children') return 'children';
  if (!record?.childId || text.includes('copil neasociat')) return 'unassigned';
  if (text.includes('posibil duplicat')) return 'duplicate';
  if (record?.importSource?.provisionalAmount || text.includes('provizori') || text.includes('metodă mixtă'))
    return 'provisional';
  if (record?.importSource?.autoMatched || text.includes('potrivire automată')) return 'automatic';
  if (text.includes('avans nerepartizat')) return 'advance';
  return 'all';
}

/**
 * @param {RecordsSnapshot} records
 * @returns {ReviewCenter}
 */
export function buildReviewCenter(records) {
  const byId = {};
  for (const type of ['children', 'payments', 'expenses'])
    byId[type] = new Map((records[type] || []).map(record => [record.id, record]));
  const grouped = new Map();
  for (const issue of findRecordIssues(records)) {
    const record = byId[issue.type].get(issue.id);
    if (!record) continue;
    const key = issue.type + ' ' + issue.id;
    if (!grouped.has(key))
      grouped.set(key, {
        type: issue.type,
        id: issue.id,
        name: issue.name,
        record,
        reasons: [],
        categories: new Set(),
      });
    const groupedEntry = grouped.get(key);
    groupedEntry.reasons.push(issue.reason);
    groupedEntry.categories.add(category(issue, record));
  }
  const items = [...grouped.values()]
    .map(entry => {
      const categories = [...entry.categories].filter(c => c !== 'all');
      const blocking = categories.some(c => ['unassigned', 'duplicate', 'provisional', 'advance'].includes(c));
      return {
        ...entry,
        categories: categories.length ? categories : ['all'],
        canConfirm:
          entry.type === 'payments' && !entry.record.reviewed && entry.categories.has('automatic') && !blocking,
      };
    })
    .sort((a, b) => {
      const order = ['unassigned', 'provisional', 'duplicate', 'automatic', 'advance', 'children'];
      const ai = Math.min(...a.categories.map(c => Math.max(0, order.indexOf(c)))),
        bi = Math.min(...b.categories.map(c => Math.max(0, order.indexOf(c))));
      return ai - bi || a.name.localeCompare(b.name, 'ro');
    });
  const sourceChecks = (records.payments || []).filter(
    payment => !payment.archived && payment.verification && !/^OK$/i.test(payment.verification.trim()),
  );
  return {
    items,
    progress: {
      total: sourceChecks.length,
      confirmed: sourceChecks.filter(payment => payment.reviewed).length,
      pending: sourceChecks.filter(payment => !payment.reviewed).length,
    },
    labels,
  };
}

/**
 * @param {ReviewCenter} center
 * @param {string} filter
 * @param {string} search
 */
export function filterReviewItems(center, filter = 'all', search = '') {
  const query = normalize(search).trim();
  return center.items.filter(item => {
    // Câmpurile de mai jos există doar pe Payment; item.record e Child | Payment.
    const record = /** @type {any} */ (item.record);
    return (
      (filter === 'all' || item.categories.includes(filter)) &&
      (!query ||
        normalize(
          [
            item.id,
            item.name,
            record.sourceName,
            record.childName,
            record.verification,
            record.notes,
            ...item.reasons,
          ].join(' '),
        ).includes(query))
    );
  });
}
