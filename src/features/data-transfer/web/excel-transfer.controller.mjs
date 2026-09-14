import { escapeHtml } from '#shared/format/html-escape.mjs';
import { recordsSummaryMarkup } from '#shared/ui/records-summary.mjs';
import { today } from '#shared/domain/calendar-month.mjs';
import { readWorkbook, exportWorkbook } from '../domain/excel-workbook.mjs';

/** @typedef {import('../data-transfer.types.mjs').ExcelTransferControllerDependencies} ExcelTransferControllerDependencies */

const EXCEL_MAX_BYTES = 20000000;

/** @param {ExcelTransferControllerDependencies} dependencies */
export function createExcelTransferController({
  elements: { importButton, excelInput, importPreview, importDialog, importConfirm, commitImport, exportButton },
  sessionState,
  readRecords,
  requestJson,
  submitMutation,
  showNotice,
  loadXlsx,
  findRecordIssues,
}) {
  importButton.onclick = () => excelInput.click();

  excelInput.onchange = async event => {
    const target = /** @type {HTMLInputElement} */ (event.target);
    const file = target.files?.[0];
    if (!file) return;
    try {
      if (file.size > EXCEL_MAX_BYTES) throw Error('Fișier prea mare (maximum 20 MB).');
      const XLSX = await loadXlsx();
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false });
      const parsed = readWorkbook(workbook, XLSX, findRecordIssues);
      // Previzualizarea locală și cea revalidată de server au forme diferite; se afișează ce a venit ultima.
      /** @type {any} */
      let report = parsed;
      // Serverul revalidează; avertizările locale despre sursă se păstrează.
      if (!parsed.errors.length) {
        const checked = await requestJson('/api/import-preview', { state: parsed.state });
        report = { ...checked, warnings: [...parsed.warnings] };
      }
      sessionState.importData = report.errors.length ? null : { state: report.state, revision: sessionState.revision };
      importConfirm.value = '';
      commitImport.disabled = !sessionState.importData;
      const records = readRecords();
      importPreview.innerHTML =
        `<p>${escapeHtml(file.name)}</p>` +
        `<p class="notice">Datele curente (${records.children.length} copii, ${records.payments.length} plăți, ${records.expenses.length} cheltuieli) vor fi înlocuite după backup.</p>` +
        (report.summary ? recordsSummaryMarkup(report.summary) : '') +
        report.errors.map(/** @param {string} error */ error => `<p class="danger">${escapeHtml(error)}</p>`).join('') +
        `<details open><summary>${report.warnings.length} avertizări</summary>${report.warnings.map(/** @param {{ id?: string, reason: string }} warning */ warning => `<p>${escapeHtml(warning.id || '')} ${escapeHtml(warning.reason)}</p>`).join('')}</details>`;
      importDialog.showModal();
    } catch (error) {
      showNotice(/** @type {Error} */ (error).message, true);
    } finally {
      target.value = '';
    }
  };

  commitImport.onclick = async () => {
    if (!sessionState.importData) return;
    commitImport.disabled = true;
    try {
      await submitMutation(
        '/api/import',
        { state: sessionState.importData.state, confirm: importConfirm.value },
        sessionState.importData.revision,
      );
      importDialog.close();
      sessionState.importData = null;
    } catch (error) {
      showNotice(/** @type {Error} */ (error).message, true);
    } finally {
      commitImport.disabled = false;
    }
  };

  exportButton.onclick = async () => {
    if (!sessionState.ready || sessionState.pending) {
      showNotice('Reîncarcă datele înainte de export.', true);
      return;
    }
    try {
      const XLSX = await loadXlsx();
      XLSX.writeFile(exportWorkbook(readRecords(), XLSX), `Startica_complet_${today()}.xlsx`, { compression: true });
    } catch (error) {
      showNotice(/** @type {Error} */ (error).message, true);
    }
  };

  return {};
}
