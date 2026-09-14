import { escapeHtml } from '#shared/format/html-escape.mjs';
import { formatDate } from '#shared/format/date-format.mjs';
import { formatParentContacts } from '#shared/format/parent-contacts-format.mjs';

/**
 * @typedef {{
 *   line: number,
 *   contractNumber: string,
 *   name: string,
 *   parent: string,
 *   phone: string,
 *   parent2: string,
 *   phone2: string,
 *   birthDate: string,
 *   attendanceDate: string,
 *   reason: string,
 *   warnings: string[],
 * }} ChildrenCsvPreviewRow
 * @typedef {{
 *   total: number,
 *   additions: unknown[],
 *   rows: ChildrenCsvPreviewRow[],
 *   errors: string[],
 *   warnings: string[],
 *   skipped: number,
 *   conflicts: number,
 *   revision?: number,
 * }} ChildrenCsvPreviewReport
 */

const CSV_MAX_BYTES = 2000000;
const CSV_CONFIRMATION_PHRASE = 'IMPORT COPII';

/**
 * @param {File} file
 * @param {ChildrenCsvPreviewReport} report
 */
function csvPreviewHTML(file, report) {
  const rows = report.rows
    .map(
      row =>
        `<tr><td>${row.line} / ${escapeHtml(row.contractNumber)}</td><td>${escapeHtml(row.name)}</td><td>${formatParentContacts(row)}</td>` +
        `<td>${formatDate(row.birthDate)}<br>${formatDate(row.attendanceDate)}</td>` +
        `<td>${escapeHtml(row.reason)}${row.warnings.map(w => `<br><small>${escapeHtml(w)}</small>`).join('')}</td></tr>`,
    )
    .join('');
  return (
    `<p><strong>${escapeHtml(file.name)}</strong></p>` +
    `<p>${report.total} rânduri · ${report.additions.length} copii noi · ${report.skipped} existenți, nemodificați · ${report.conflicts} conflicte, neimportate</p>` +
    report.errors.map(e => `<p class="danger">${escapeHtml(e)}</p>`).join('') +
    report.warnings.map(w => `<p>${escapeHtml(w)}</p>`).join('') +
    `<div class="table-wrap"><table><thead><tr><th>Rând / contract</th><th>Copil</th><th>Părinte / telefon</th><th>Naștere / frecventare</th><th>Rezultat</th></tr></thead><tbody>${rows}</tbody></table></div>`
  );
}

/**
 * @param {{
 *   elements: {
 *     importButton: HTMLButtonElement,
 *     fileInput: HTMLInputElement,
 *     dialog: HTMLDialogElement,
 *     preview: HTMLElement,
 *     confirmInput: HTMLInputElement,
 *     commitButton: HTMLButtonElement,
 *     errorText: HTMLElement,
 *   },
 *   sessionState: {
 *     ready: boolean,
 *     pending: unknown,
 *     busy: boolean,
 *     csvLoading: boolean,
 *     csvData: { csv: string, revision: number, count: number } | null,
 *   },
 *   requestJson: (path: string, body?: unknown) => Promise<any>,
 *   submitMutation: (path: string, body: Record<string, unknown>, base?: number) => Promise<any>,
 *   showNotice: (message: string, isError?: boolean) => void,
 * }} dependencies
 */
export function createChildrenCsvDialog({
  elements: { importButton, fileInput, dialog, preview, confirmInput, commitButton, errorText },
  sessionState,
  requestJson,
  submitMutation,
  showNotice,
}) {
  importButton.onclick = () => {
    if (!sessionState.ready || sessionState.pending || sessionState.busy || sessionState.csvLoading) {
      showNotice('Așteaptă sau reîncarcă datele înainte de import.', true);
      return;
    }
    fileInput.click();
  };

  fileInput.onchange = async event => {
    const file = /** @type {HTMLInputElement} */ (event.target).files?.[0];
    if (!file || sessionState.csvLoading) return;
    sessionState.csvLoading = true;
    sessionState.csvData = null;
    commitButton.disabled = true;
    errorText.textContent = '';
    try {
      if (file.size > CSV_MAX_BYTES) throw Error('CSV prea mare (maximum 2 MB).');
      // fatal: true => un fișier care nu e UTF-8 este respins, nu citit greșit.
      const csv = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer());
      const report = await requestJson('/api/children-csv-preview', { csv });
      confirmInput.value = '';
      preview.innerHTML = csvPreviewHTML(file, report);
      if (!report.errors.length && report.additions.length)
        sessionState.csvData = { csv, revision: report.revision, count: report.additions.length };
      dialog.showModal();
    } catch (error) {
      showNotice(/** @type {Error} */ (error).message, true);
    } finally {
      sessionState.csvLoading = false;
      /** @type {HTMLInputElement} */ (event.target).value = '';
    }
  };

  confirmInput.oninput = () => {
    commitButton.disabled = !sessionState.csvData || confirmInput.value !== CSV_CONFIRMATION_PHRASE;
  };

  commitButton.onclick = async () => {
    if (!sessionState.csvData || sessionState.busy) return;
    commitButton.disabled = true;
    errorText.textContent = '';
    try {
      const count = sessionState.csvData.count;
      const result = await submitMutation(
        '/api/children-csv',
        { csv: sessionState.csvData.csv, confirm: confirmInput.value },
        sessionState.csvData.revision,
      );
      dialog.close();
      sessionState.csvData = null;
      if (!result.warning)
        showNotice(`${count} copii importați. Fișele existente, achitările și cheltuielile au fost păstrate.`);
    } catch (error) {
      errorText.textContent = /** @type {Error} */ (error).message;
      showNotice(/** @type {Error} */ (error).message, true);
    } finally {
      commitButton.disabled = !sessionState.csvData || !!sessionState.pending;
    }
  };

  // Cât timp o operațiune este neconfirmată, datele previzualizate trebuie
  // păstrate pentru reluare.
  dialog.addEventListener('close', () => {
    if (!sessionState.pending) sessionState.csvData = null;
  });

  return {};
}
