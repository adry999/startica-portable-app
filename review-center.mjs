import { issues } from './domain.mjs';

export const reviewFilters = [
  ['all', 'Toate problemele'],
  ['unassigned', 'Achitări fără copil'],
  ['duplicate', 'Posibile dubluri'],
  ['provisional', 'Sume mixte / provizorii'],
  ['automatic', 'Potriviri automate'],
  ['advance', 'Avans nerepartizat'],
  ['children', 'Fișe copii'],
];
const labels = Object.fromEntries(reviewFilters);
const normalize = value => String(value || '').toLocaleLowerCase('ro-RO');
function category(issue, record) {
  const text = normalize(issue.reason + ' ' + record?.verification + ' ' + record?.notes + ' ' + record?.method);
  if (issue.type === 'children') return 'children';
  if (!record?.childId || text.includes('copil neasociat')) return 'unassigned';
  if (text.includes('posibil duplicat')) return 'duplicate';
  if (record?.importSource?.provisionalAmount || text.includes('provizori') || text.includes('metodă mixtă'))
    return 'provisional';
  if (text.includes('potrivire automată')) return 'automatic';
  if (text.includes('avans nerepartizat')) return 'advance';
  return 'all';
}
export function reviewCenter(state) {
  const records = {};
  for (const type of ['children', 'payments', 'expenses'])
    records[type] = new Map((state[type] || []).map(r => [r.id, r]));
  const grouped = new Map();
  for (const issue of issues(state)) {
    const record = records[issue.type].get(issue.id);
    if (!record) continue;
    const key = issue.type + '\u0000' + issue.id;
    if (!grouped.has(key))
      grouped.set(key, {
        type: issue.type,
        id: issue.id,
        name: issue.name,
        record,
        reasons: [],
        categories: new Set(),
      });
    const item = grouped.get(key);
    item.reasons.push(issue.reason);
    item.categories.add(category(issue, record));
  }
  const items = [...grouped.values()]
    .map(item => {
      const categories = [...item.categories].filter(c => c !== 'all');
      const blocking = categories.some(c => ['unassigned', 'duplicate', 'provisional', 'advance'].includes(c));
      return {
        ...item,
        categories: categories.length ? categories : ['all'],
        canConfirm: item.type === 'payments' && !item.record.reviewed && item.categories.has('automatic') && !blocking,
      };
    })
    .sort((a, b) => {
      const order = ['unassigned', 'provisional', 'duplicate', 'automatic', 'advance', 'children'];
      const ai = Math.min(...a.categories.map(c => Math.max(0, order.indexOf(c)))),
        bi = Math.min(...b.categories.map(c => Math.max(0, order.indexOf(c))));
      return ai - bi || a.name.localeCompare(b.name, 'ro');
    });
  const sourceChecks = (state.payments || []).filter(
    p => !p.archived && p.verification && !/^OK$/i.test(p.verification.trim()),
  );
  return {
    items,
    progress: {
      total: sourceChecks.length,
      confirmed: sourceChecks.filter(p => p.reviewed).length,
      pending: sourceChecks.filter(p => !p.reviewed).length,
    },
    labels,
  };
}
export function filteredReviewItems(center, filter = 'all', search = '') {
  const query = normalize(search).trim();
  return center.items.filter(
    item =>
      (filter === 'all' || item.categories.includes(filter)) &&
      (!query ||
        normalize(
          [
            item.id,
            item.name,
            item.record.sourceName,
            item.record.childName,
            item.record.verification,
            item.record.notes,
            ...item.reasons,
          ].join(' '),
        ).includes(query)),
  );
}
