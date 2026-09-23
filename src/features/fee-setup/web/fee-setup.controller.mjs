import { monthOK } from '#shared/domain/calendar-month.mjs';
import { normalizeSearchText } from '#shared/format/text-search.mjs';
import { groupOptionsMarkup } from '#shared/ui/form-fields.mjs';
import { matchesRecordListSearch } from '#shared/ui/record-list-search.mjs';
import { sortTable } from '#shared/ui/table-sort.mjs';
import { contractNumberOf, groupNameOf } from '#shared/domain/record-labels.mjs';
import { defaultSetupMonth, hasMissingFee } from '../domain/child-fee-setup.mjs';
import { feeSetupRowMarkup } from './fee-setup.view.mjs';

/** @typedef {import('#shared/contracts/record-types.mjs').RecordsSnapshot} RecordsSnapshot */
/** @typedef {import('#shared/contracts/record-types.mjs').Child} Child */

/**
 * @param {{
 *   elements: {
 *     info: HTMLElement,
 *     table: HTMLTableElement,
 *     pending: HTMLElement,
 *     search: HTMLInputElement,
 *     filter: HTMLSelectElement,
 *     bulkAmount: HTMLInputElement,
 *     bulkGroup: HTMLSelectElement,
 *     bulkStatus: HTMLSelectElement,
 *     applyAll: HTMLButtonElement,
 *     saveBar: HTMLElement,
 *     save: HTMLButtonElement,
 *     failure: HTMLElement,
 *   },
 *   readRecords: () => RecordsSnapshot,
 *   readToday: () => string,
 *   submitMutation: (path: string, body: unknown) => Promise<{ warning?: string }>,
 *   showNotice: (message: string, isError?: boolean) => void,
 *   renderMissingFeeCount: (count: number) => void,
 * }} dependencies
 */
export function createFeeSetupController({
  elements: {
    info,
    table,
    pending,
    search,
    filter,
    bulkAmount,
    bulkGroup,
    bulkStatus,
    applyAll,
    saveBar,
    save,
    failure,
  },
  readRecords,
  readToday,
  submitMutation,
  showNotice,
  renderMissingFeeCount,
}) {
  /**
   * @param {RecordsSnapshot} records
   * @param {string} normalizedSearch
   */
  function visibleChildren(records, normalizedSearch) {
    // Ordinea alfabetică e baza; sortTable() o înlocuiește doar cât timp un antet e activ.
    return records.children
      .filter(
        child =>
          !child.archived &&
          (filter.value === 'all' || hasMissingFee(child)) &&
          matchesRecordListSearch('children', child, records, normalizedSearch),
      )
      .sort((a, b) => a.name.localeCompare(b.name, 'ro'));
  }

  const editableRows = () =>
    Array.from(/** @type {NodeListOf<HTMLTableRowElement>} */ (table.querySelectorAll('tr[data-child]')));

  // Un rând neatins nu diferă de valoarea „initial” scrisă în randare — la fel ca în collect().
  function hasPendingEdits() {
    return editableRows().some(row => {
      const fee = /** @type {HTMLInputElement} */ (row.querySelector('[data-fee]'));
      const group = /** @type {HTMLSelectElement} */ (row.querySelector('[data-group]'));
      const status = /** @type {HTMLSelectElement} */ (row.querySelector('[data-status]'));
      return (
        (fee.value.trim() !== '' && fee.value.trim() !== fee.dataset.feeInitial) ||
        group.value !== group.dataset.groupInitial ||
        status.value !== status.dataset.statusInitial
      );
    });
  }

  // Filtrul, căutarea și sortarea re-randează tabelul din date; fără asta, orice completare
  // neatinsă încă (fee/grupă/statut) dispărea tăcut la fiecare clic pe un antet sortabil.
  function capturePendingEdits() {
    /** @type {Map<string, { fee: string, group: string, status: string, from: string }>} */
    const edits = new Map();
    for (const row of editableRows()) {
      edits.set(row.dataset.child ?? '', {
        fee: /** @type {HTMLInputElement} */ (row.querySelector('[data-fee]')).value,
        group: /** @type {HTMLSelectElement} */ (row.querySelector('[data-group]')).value,
        status: /** @type {HTMLSelectElement} */ (row.querySelector('[data-status]')).value,
        from: /** @type {HTMLInputElement} */ (row.querySelector('[data-from]')).value,
      });
    }
    return edits;
  }

  /** @param {Map<string, { fee: string, group: string, status: string, from: string }>} edits */
  function applyPendingEdits(edits) {
    for (const row of editableRows()) {
      const saved = edits.get(row.dataset.child ?? '');
      if (!saved) continue;
      /** @type {HTMLInputElement} */ (row.querySelector('[data-fee]')).value = saved.fee;
      /** @type {HTMLSelectElement} */ (row.querySelector('[data-group]')).value = saved.group;
      /** @type {HTMLSelectElement} */ (row.querySelector('[data-status]')).value = saved.status;
      /** @type {HTMLInputElement} */ (row.querySelector('[data-from]')).value = saved.from;
    }
  }

  function render() {
    const records = readRecords();
    const groupsSortedByName = [...records.groups].sort((a, b) => a.name.localeCompare(b.name, 'ro'));
    const missing = records.children.filter(child => !child.archived && hasMissingFee(child)).length;
    renderMissingFeeCount(missing);
    info.textContent = missing
      ? `${missing} copii fără taxă completată: nu pot fi evaluați și nu apar pe lista de notificat.`
      : 'Toți copiii nearhivați au taxa completată.';
    const today = readToday();
    const pendingEdits = capturePendingEdits();
    const rows = sortTable(
      'fees',
      visibleChildren(records, normalizeSearchText(search.value)),
      /** @type {Record<string, (child: Child) => unknown>} */ ({
        contract: contractNumberOf,
        name: child => child.name,
        attendance: child => child.attendanceDate,
        group: child => groupNameOf(child.groupId, records.groups),
        fee: child => child.feeHistory?.at(-1)?.amount ?? child.fee ?? 0,
        from: child => defaultSetupMonth(child, today),
        status: child => child.status || 'Activ',
      }),
      render,
    );
    table.innerHTML =
      rows.map(child => feeSetupRowMarkup(child, groupsSortedByName, today)).join('') ||
      '<tr><td colspan="7" class="empty">Nimic de completat pentru filtrul ales.</td></tr>';
    applyPendingEdits(pendingEdits);
    pending.textContent = `${rows.length} rânduri afișate`;
    bulkGroup.innerHTML = groupOptionsMarkup(groupsSortedByName, '');
    saveBar.hidden = !hasPendingEdits();
  }

  // Se trimite un câmp doar dacă diferă de valoarea afișată inițial, ca un rând
  // neatins să nu suprascrie tăcut o fișă existentă.
  function collect() {
    const updates = [];
    for (const row of editableRows()) {
      const feeInput = /** @type {HTMLInputElement} */ (row.querySelector('[data-fee]'));
      const groupInput = /** @type {HTMLSelectElement} */ (row.querySelector('[data-group]'));
      const statusInput = /** @type {HTMLSelectElement} */ (row.querySelector('[data-status]'));
      const fromInput = /** @type {HTMLInputElement} */ (row.querySelector('[data-from]'));
      const fee = feeInput.value.trim();
      const group = groupInput.value;
      const status = statusInput.value;
      /** @type {{ id: string, from: string, fee?: number, groupId?: string | null, status?: string }} */
      const update = { id: row.dataset.child ?? '', from: fromInput.value };
      let changed = false;
      if (fee !== '' && fee !== feeInput.dataset.feeInitial) {
        update.fee = Number(fee);
        changed = true;
      }
      if (group !== groupInput.dataset.groupInitial) {
        update.groupId = group || null;
        changed = true;
      }
      if (status !== statusInput.dataset.statusInitial) {
        update.status = status;
        changed = true;
      }
      if (!changed) continue;
      if (!monthOK(update.from)) throw Error(`Completează luna de aplicare pentru ${row.cells[1].textContent}.`);
      updates.push(update);
    }
    return updates;
  }

  filter.onchange = render;
  search.oninput = render;
  // Un rând tastat direct nu trece prin render(): bara trebuie arătată la primul input.
  table.addEventListener('input', () => {
    saveBar.hidden = false;
  });
  table.addEventListener('change', () => {
    saveBar.hidden = false;
  });

  applyAll.onclick = () => {
    const amount = bulkAmount.value.trim();
    const group = bulkGroup.value;
    const status = bulkStatus.value;
    if (!amount && !group && !status) {
      showNotice('Completează o taxă, o grupă sau un statut de aplicat.', true);
      return;
    }
    for (const row of editableRows()) {
      if (amount) /** @type {HTMLInputElement} */ (row.querySelector('[data-fee]')).value = amount;
      if (group) /** @type {HTMLSelectElement} */ (row.querySelector('[data-group]')).value = group;
      if (status) /** @type {HTMLSelectElement} */ (row.querySelector('[data-status]')).value = status;
    }
    saveBar.hidden = false;
    showNotice('Valorile au fost puse pe rândurile afișate. Verifică excepțiile, apoi salvează.');
  };

  save.onclick = async () => {
    failure.textContent = '';
    try {
      const updates = collect();
      if (!updates.length) throw Error('Nu ai completat nicio taxă.');
      save.disabled = true;
      const result = await submitMutation('/api/children-setup', { updates });
      if (!result.warning) {
        saveBar.hidden = true;
        showNotice(`${updates.length} fișe completate. Verifică lista „De notificat”.`);
      }
    } catch (error) {
      failure.textContent = /** @type {Error} */ (error).message;
      showNotice(/** @type {Error} */ (error).message, true);
    } finally {
      save.disabled = false;
    }
  };

  return { render };
}
