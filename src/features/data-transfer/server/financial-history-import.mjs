import { createHash } from 'node:crypto';
import { validateState, normalizeRecord } from '#shared/domain/record-schema.mjs';
import { total } from '#shared/domain/money.mjs';
import { fail } from '#core/server/errors/domain-error.mjs';

/** @typedef {import('#shared/contracts/record-types.mjs').RecordsSnapshot} RecordsSnapshot */
/** @typedef {import('#shared/contracts/record-types.mjs').Payment} Payment */
/** @typedef {import('#shared/contracts/record-types.mjs').Expense} Expense */
/** @typedef {import('../data-transfer.types.mjs').FinancialHistoryPlan} FinancialHistoryPlan */
/** Doar câmpurile citite efectiv aici; fixture-urile de test nu trebuie să completeze grupe/categorii nefolosite. */
/** @typedef {Pick<RecordsSnapshot, 'children' | 'payments' | 'expenses'>} FinancialImportTargetRecords */
/** @typedef {('payments' | 'expenses')[]} FinancialRecordTypeList */

const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const nameKey = v =>
  String(v || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
const contractKey = v =>
  String(v || '')
    .trim()
    .replace(/^(ID|CSV)-/i, '')
    .replace(/^0+(?=\d)/, '')
    .toUpperCase();

/**
 * Import financiar V5, doar adăugare. Copiii și operațiunile existente nu se modifică niciodată.
 * @param {any} input
 * @param {FinancialImportTargetRecords} currentRecords
 * @returns {FinancialHistoryPlan}
 */
export function planFinancialHistoryImport(input, currentRecords) {
  if (
    input?.format !== 'STARTICA_V5' ||
    typeof input.sourceName !== 'string' ||
    !input.sourceName.trim() ||
    input.sourceName.length > 250 ||
    !/^[a-f0-9]{64}$/.test(input.sourceHash || '')
  )
    fail('Sursă V5 invalidă.');
  const source = /** @type {RecordsSnapshot} */ (validateState(input.state)),
    mapping = new Map(),
    used = new Set();
  for (const child of source.children) {
    const matches = currentRecords.children.filter(
      c =>
        nameKey(c.name) === nameKey(child.name) &&
        c.birthDate &&
        c.birthDate === child.birthDate &&
        contractKey(c.contractNumber || c.id) === contractKey(child.id),
    );
    if (matches.length !== 1 || used.has(matches[0].id))
      fail(`Copilul ${child.id} nu are o corespondență unică după contract, nume și data nașterii. Import oprit.`);
    mapping.set(child.id, matches[0].id);
    used.add(matches[0].id);
  }
  /** @type {{ payments: Payment[], expenses: Expense[] }} */
  const additions = { payments: [], expenses: [] },
    skipped = { payments: 0, expenses: 0 };
  /** @type {FinancialRecordTypeList} */
  const recordTypesToImport = ['payments', 'expenses'];
  for (const type of recordTypesToImport) {
    const existing = new Map(currentRecords[type].map(r => /** @type {[string, any]} */ ([r.id, r])));
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
        fail(
          `${original.id}: ID deja existent sau sursă modificată. Nu suprascriem operațiunea; verifică înainte de import.`,
        );
      }
      // Payment | Expense nu se corelează pe ramuri de tip generic după `type`; structura reală e
      // verificată de normalizeRecord() mai jos.
      const addition = /** @type {any} */ (structuredClone(original));
      if (type === 'payments' && addition.childId) {
        const target = mapping.get(addition.childId);
        if (!target) fail(`${addition.id}: copilul din sursă nu poate fi asociat.`);
        addition.childId = target;
      }
      const provisional =
        type === 'payments' && (/provizori/i.test(addition.notes || '') || /mixt/i.test(addition.method));
      if (provisional) {
        addition.verification = [
          addition.verification,
          'SUMĂ PROVIZORIE — verifică totalul și împărțirea Cash/Card în textul original',
        ]
          .filter(Boolean)
          .join('; ');
        addition.reviewed = false;
      }
      addition.importSource = {
        kind: 'v5-financial',
        file: input.sourceName,
        fileHash: input.sourceHash,
        recordId: original.id,
        recordDigest: sourceDigest,
        childId: /** @type {any} */ (original).childId || '',
        provisionalAmount: provisional,
        autoMatched: type === 'payments' && /potrivire automat[ăa]/i.test(addition.verification || ''),
      };
      additions[type].push(normalizeRecord(type, addition));
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
      provisional: additions.payments.filter(p => p.importSource?.provisionalAmount).length,
    },
  };
}
