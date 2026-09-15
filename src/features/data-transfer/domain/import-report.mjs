import { validateState } from '#shared/domain/record-schema.mjs';
import { summary } from '#shared/domain/records-report.mjs';
import { upgradeSnapshot } from '#shared/domain/record-snapshot-upgrade.mjs';

/** @typedef {import('../data-transfer.types.mjs').FindRecordIssues} FindRecordIssues */
/** @typedef {import('../data-transfer.types.mjs').ImportReport} ImportReport */

/**
 * Validează o stare brută (Excel sau backup) și construiește raportul de previzualizare a
 * unui import: starea normalizată, rezumatul ei și avertizările de conținut, sau doar erorile.
 * Aduce mai întâi formatul la zi (vezi upgradeSnapshot), pentru reimportul unui export vechi.
 * findRecordIssues vine din review-center, primit ca parametru — feature-urile nu se importă reciproc.
 * @param {any} input
 * @param {FindRecordIssues} findRecordIssues
 * @returns {ImportReport}
 */
export function buildImportReport(input, findRecordIssues) {
  const { snapshot, notes } = upgradeSnapshot(input);
  try {
    const state = validateState(snapshot);
    return { state, summary: summary(state), warnings: findRecordIssues(state), errors: [], notes };
  } catch (error) {
    return { errors: [/** @type {Error} */ (error).message], warnings: [], notes };
  }
}
