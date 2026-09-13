import { validateState } from '#shared/domain/record-schema.mjs';
import { summary } from '#shared/domain/records-report.mjs';

/** @typedef {import('../data-transfer.types.mjs').FindRecordIssues} FindRecordIssues */
/** @typedef {import('../data-transfer.types.mjs').ImportReport} ImportReport */

/**
 * Validează o stare brută (Excel sau backup) și construiește raportul de previzualizare a
 * unui import: starea normalizată, rezumatul ei și avertizările de conținut, sau doar erorile.
 * findRecordIssues vine din review-center, primit ca parametru — feature-urile nu se importă reciproc.
 * @param {any} input
 * @param {FindRecordIssues} findRecordIssues
 * @returns {ImportReport}
 */
export function buildImportReport(input, findRecordIssues) {
  try {
    const state = validateState(input);
    return { state, summary: summary(state), warnings: findRecordIssues(state), errors: [] };
  } catch (error) {
    return { errors: [/** @type {Error} */ (error).message], warnings: [] };
  }
}
