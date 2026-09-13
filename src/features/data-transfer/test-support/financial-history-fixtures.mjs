import { normalizeRecord } from '#shared/domain/record-schema.mjs';

/** @typedef {import('#shared/contracts/record-types.mjs').Child} Child */
/** @typedef {import('../data-transfer.types.mjs').FinancialHistorySource} FinancialHistorySource */

/** @returns {Child} copilul așa cum apare în exportul V5 sursă */
export function v5SourceChild() {
  return normalizeRecord('children', { id: 'ID-1', name: 'Copil Test', birthDate: '2022-01-01' });
}

/** @returns {Child} aceeași fișă, deja existentă în baza curentă sub alt id (venit din CSV) */
export function currentMatchingChild() {
  return {
    ...v5SourceChild(),
    id: 'CSV-1',
    contractNumber: '1',
    parent2: 'Contact păstrat',
    phone2: '060123456',
    fee: 999,
  };
}

/** @returns {FinancialHistorySource} */
export function v5FinancialSource() {
  return {
    format: 'STARTICA_V5',
    sourceName: 'test.xlsx',
    sourceHash: 'a'.repeat(64),
    state: {
      children: [v5SourceChild()],
      payments: [
        normalizeRecord('payments', {
          id: 'PAY-1',
          childId: 'ID-1',
          date: '2026-09-08',
          amount: 100,
          method: 'Mixtă',
          notes: 'Sumă provizorie',
          original: 'Text sursă',
          verification: 'De verificat',
        }),
      ],
      expenses: [normalizeRecord('expenses', { id: 'EXP-1', date: '2026-09-08', amount: 50 })],
      groups: [],
      categories: [],
    },
  };
}
