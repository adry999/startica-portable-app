import { escapeHtml } from '#shared/format/html-escape.mjs';
import { byId } from './element-lookup.mjs';

/** @typedef {{ id: string, archived?: boolean }} SelectableRecord */

// Casetă „selectează tot ce se vede”, generată în antetul listei (Copii, Achitări, Cheltuieli).
export const selectAllCheckboxMarkup = listId =>
  `<input type="checkbox" id="${listId}SelectAll" title="Selectează tot ce se vede">`;

// Caseta unui rând, cu starea bifată păstrată din selecția curentă.
export const rowCheckboxMarkup = (id, isSelected) =>
  `<input type="checkbox" class="row-select" data-id="${escapeHtml(id)}" ${isSelected ? 'checked' : ''}>`;

/** @param {{ selectedCount: number, isArchivedView: boolean }} args */
export function bulkActionButtonLabel({ selectedCount, isArchivedView }) {
  const verb = isArchivedView ? 'Dezarhivează selectate' : 'Arhivează selectate';
  return selectedCount ? `${verb} (${selectedCount})` : verb;
}

/** @param {{ typeLabel: string, count: number, isArchivedView: boolean }} args */
export function bulkActionResultMessage({ typeLabel, count, isArchivedView }) {
  const action = isArchivedView ? 'dezarhivate' : 'arhivate';
  return `${count} ${typeLabel} ${action}.`;
}

// Sar peste fișele deja în starea țintă, ca un id rămas din selecție (arhivat
// între timp altfel) să nu retrimită aceeași mutație.
/**
 * @param {string[]} ids
 * @param {SelectableRecord[]} records
 * @param {boolean} targetArchived
 */
export function pickRecordsToToggle(ids, records, targetArchived) {
  const result = [];
  for (const id of ids) {
    const record = records.find(r => r.id === id);
    if (!record) continue;
    if (Boolean(record.archived) === targetArchived) continue;
    result.push(record);
  }
  return result;
}

/**
 * @param {import('#shared/contracts/record-types.mjs').RecordType} recordType
 * @param {SelectableRecord} record
 * @param {boolean} targetArchived
 * @param {string} [archivedAtIso]
 */
export function buildArchiveMutationBody(recordType, record, targetArchived, archivedAtIso = new Date().toISOString()) {
  return {
    type: recordType,
    mode: 'update',
    record: { ...record, archived: targetArchived, archivedAt: targetArchived ? archivedAtIso : null },
  };
}

/**
 * Selecția pentru arhivare/dezarhivare în masă a unei liste (Copii, Achitări,
 * Cheltuieli). Starea persistă între randări (checkbox-urile revin bifate) —
 * de aceea controller-ul se creează o singură dată, iar `wireRowCheckboxes`
 * se rechemă după fiecare randare a tabelului (rândurile fiind reconstruite).
 * @param {{
 *   recordType: import('#shared/contracts/record-types.mjs').RecordType,
 *   typeLabel: string,
 *   elements: { table: HTMLElement, selectAllId: string, bulkButton: HTMLButtonElement, archiveFilter?: HTMLSelectElement },
 *   readRecords: () => SelectableRecord[],
 *   submitMutation: (path: string, body: unknown) => Promise<{ warning?: string }>,
 *   showNotice: (message: string, isError?: boolean) => void,
 * }} dependencies
 */
export function createBulkSelectionController({
  recordType,
  typeLabel,
  elements: { table, selectAllId, bulkButton: bulkButtonElement, archiveFilter },
  readRecords,
  submitMutation,
  showNotice,
}) {
  /** @type {Set<string>} */
  const selectedIds = new Set();
  // Timer-ul de confirmare ("Sigur?") e ținut direct pe element, ca la butonul
  // static de arhivare din HTML — nu face parte din tipul standard al butonului.
  const bulkButton = /** @type {HTMLButtonElement & { _confirmTimer?: ReturnType<typeof setTimeout> }} */ (
    bulkButtonElement
  );

  const isArchivedView = () => archiveFilter?.value === 'archived';
  const isSelected = id => selectedIds.has(id);
  const rowCheckboxMarkupFor = id => rowCheckboxMarkup(id, isSelected(id));

  function updateBulkActionButton() {
    if (!bulkButton) return;
    clearTimeout(bulkButton._confirmTimer);
    bulkButton.classList.remove('confirm-pending');
    bulkButton.disabled = selectedIds.size === 0;
    bulkButton.textContent = bulkActionButtonLabel({
      selectedCount: selectedIds.size,
      isArchivedView: isArchivedView(),
    });
  }

  // Casetele se reconstruiesc la fiecare randare a tabelului (inclusiv caseta
  // „selectează tot” din antet), deci legarea lor se reface aici, nu o singură
  // dată — spre deosebire de butonul de arhivare în masă, static din HTML.
  function wireRowCheckboxes() {
    const boxes = Array.from(/** @type {NodeListOf<HTMLInputElement>} */ (table.querySelectorAll('.row-select')));
    for (const checkbox of boxes)
      checkbox.onchange = () => {
        if (checkbox.checked) selectedIds.add(checkbox.dataset.id ?? '');
        else selectedIds.delete(checkbox.dataset.id ?? '');
        updateBulkActionButton();
      };
    const selectAll = /** @type {HTMLInputElement | null} */ (byId(selectAllId));
    if (selectAll) {
      selectAll.checked = boxes.length > 0 && boxes.every(checkbox => checkbox.checked);
      selectAll.onchange = () => {
        for (const checkbox of boxes) {
          checkbox.checked = selectAll.checked;
          if (selectAll.checked) selectedIds.add(checkbox.dataset.id ?? '');
          else selectedIds.delete(checkbox.dataset.id ?? '');
        }
        updateBulkActionButton();
      };
    }
    updateBulkActionButton();
  }

  // Butonul e static în HTML: legarea e o singură dată, la construirea listei —
  // spre deosebire de casetele din tabel, reconstruite la fiecare randare.
  // Fără fereastră de confirmare: primul click doar cere confirmarea, rămâne
  // fix pe buton; al doilea, în 4 secunde, chiar declanșează mutația.
  function bindBulkActionButton() {
    if (!bulkButton) return;
    bulkButton.onclick = async () => {
      if (!bulkButton.classList.contains('confirm-pending')) {
        bulkButton.classList.add('confirm-pending');
        bulkButton.dataset.label = bulkButton.textContent ?? '';
        bulkButton.textContent = `Sigur? ${bulkButton.textContent}`;
        bulkButton._confirmTimer = setTimeout(() => {
          bulkButton.classList.remove('confirm-pending');
          bulkButton.textContent = bulkButton.dataset.label ?? '';
        }, 4000);
        return;
      }
      clearTimeout(bulkButton._confirmTimer);
      bulkButton.classList.remove('confirm-pending');
      bulkButton.disabled = true;
      const ids = [...selectedIds];
      // Filtrul se citește o singură dată: mesajul descrie acțiunea făcută, chiar dacă filtrul se schimbă între timp.
      const archivedView = isArchivedView();
      const targetArchived = !archivedView;
      try {
        const toToggle = pickRecordsToToggle(ids, readRecords(), targetArchived);
        for (const record of toToggle)
          await submitMutation('/api/record', buildArchiveMutationBody(recordType, record, targetArchived));
        selectedIds.clear();
        showNotice(bulkActionResultMessage({ typeLabel, count: ids.length, isArchivedView: archivedView }));
      } catch (error) {
        showNotice(/** @type {Error} */ (error).message, true);
      } finally {
        updateBulkActionButton();
      }
    };
  }

  bindBulkActionButton();

  return { selectedIds, isSelected, rowCheckboxMarkupFor, wireRowCheckboxes, updateBulkActionButton };
}
