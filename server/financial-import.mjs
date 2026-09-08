import { createHash } from 'node:crypto';
import { validateState, normalizeRecord, total } from '../shared/domain.mjs';

const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const nameKey = v =>
  String(v || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
const contractKey = v =>
  String(v || '')
    .trim()
    .replace(/^(ID|CSV)-/i, '')
    .replace(/^0+(?=\d)/, '')
    .toUpperCase();

// Add-only V5 financial import. Children and existing operations are never edited.
export function financialImportPlan(input, current) {
  if (
    input?.format !== 'STARTICA_V5' ||
    typeof input.sourceName !== 'string' ||
    !input.sourceName.trim() ||
    input.sourceName.length > 250 ||
    !/^[a-f0-9]{64}$/.test(input.sourceHash || '')
  )
    throw Error('Sursă V5 invalidă.');
  const source = validateState(input.state),
    mapping = new Map(),
    used = new Set();
  for (const child of source.children) {
    const matches = current.children.filter(
      c =>
        nameKey(c.name) === nameKey(child.name) &&
        c.birthDate &&
        c.birthDate === child.birthDate &&
        contractKey(c.contractNumber || c.id) === contractKey(child.id),
    );
    if (matches.length !== 1 || used.has(matches[0].id))
      throw Error(
        `Copilul ${child.id} nu are o corespondență unică după contract, nume și data nașterii. Import oprit.`,
      );
    mapping.set(child.id, matches[0].id);
    used.add(matches[0].id);
  }
  const additions = { payments: [], expenses: [] },
    skipped = { payments: 0, expenses: 0 };
  for (const type of ['payments', 'expenses']) {
    const existing = new Map(current[type].map(r => [r.id, r]));
    for (const original of source[type]) {
      const sourceDigest = digest(original),
        old = existing.get(original.id);
      if (old) {
        if (
          old.importSource?.kind === 'v5-financial' &&
          old.importSource.recordId === original.id &&
          old.importSource.recordDigest === sourceDigest
        ) {
          skipped[type]++;
          continue;
        }
        throw Error(
          `${original.id}: ID deja existent sau sursă modificată. Nu suprascriem operațiunea; verifică înainte de import.`,
        );
      }
      const r = structuredClone(original);
      if (type === 'payments' && r.childId) {
        const target = mapping.get(r.childId);
        if (!target) throw Error(`${r.id}: copilul din sursă nu poate fi asociat.`);
        r.childId = target;
      }
      const provisional = type === 'payments' && (/provizori/i.test(r.notes || '') || /mixt/i.test(r.method));
      if (provisional) {
        r.verification = [
          r.verification,
          'SUMĂ PROVIZORIE — verifică totalul și împărțirea Cash/Card în textul original',
        ]
          .filter(Boolean)
          .join('; ');
        r.reviewed = false;
      }
      r.importSource = {
        kind: 'v5-financial',
        file: input.sourceName,
        fileHash: input.sourceHash,
        recordId: original.id,
        recordDigest: sourceDigest,
        childId: original.childId || '',
        provisionalAmount: provisional,
      };
      additions[type].push(normalizeRecord(type, r));
    }
  }
  return {
    additions,
    skipped,
    mappedChildren: mapping.size,
    summary: {
      payments: additions.payments.length,
      expenses: additions.expenses.length,
      paymentTotal: total(additions.payments),
      expenseTotal: total(additions.expenses),
      unassigned: additions.payments.filter(p => !p.childId).length,
      provisional: additions.payments.filter(p => p.importSource.provisionalAmount).length,
    },
  };
}
