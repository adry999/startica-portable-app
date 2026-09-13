import { monthOK } from '#shared/domain/calendar-month.mjs';
import { hasMissingFee } from '../domain/child-fee-setup.mjs';
import { groupOptionsMarkup, feeSetupRowMarkup } from './fee-setup.view.mjs';

/** @typedef {import('#shared/contracts/record-types.mjs').RecordsSnapshot} RecordsSnapshot */

/**
 * @param {{
 *   elements: {
 *     info: HTMLElement,
 *     table: HTMLTableElement,
 *     pending: HTMLElement,
 *     filter: HTMLSelectElement,
 *     bulkAmount: HTMLInputElement,
 *     bulkGroup: HTMLSelectElement,
 *     bulkStatus: HTMLSelectElement,
 *     applyAll: HTMLButtonElement,
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
  elements: { info, table, pending, filter, bulkAmount, bulkGroup, bulkStatus, applyAll, save, failure },
  readRecords,
  readToday,
  submitMutation,
  showNotice,
  renderMissingFeeCount,
}) {
  /** @param {RecordsSnapshot} records */
  function visibleChildren(records) {
    return records.children
      .filter(child => !child.archived && (filter.value === 'all' || hasMissingFee(child)))
      .sort((a, b) => a.name.localeCompare(b.name, 'ro'));
  }

  function render() {
    const records = readRecords();
    const missing = records.children.filter(child => !child.archived && hasMissingFee(child)).length;
    renderMissingFeeCount(missing);
    info.textContent = missing
      ? `${missing} copii fără taxă completată: nu pot fi evaluați și nu apar pe lista de notificat.`
      : 'Toți copiii nearhivați au taxa completată.';
    const today = readToday();
    const rows = visibleChildren(records);
    table.innerHTML =
      rows.map(child => feeSetupRowMarkup(child, records.groups, today)).join('') ||
      '<tr><td colspan="7" class="empty">Nimic de completat pentru filtrul ales.</td></tr>';
    pending.textContent = `${rows.length} rânduri afișate`;
    bulkGroup.innerHTML = groupOptionsMarkup(records.groups, '');
  }

  // Se trimite un câmp doar dacă diferă de valoarea afișată inițial, ca un rând
  // neatins să nu suprascrie tăcut o fișă existentă.
  function collect() {
    const updates = [];
    for (const row of Array.from(
      /** @type {NodeListOf<HTMLTableRowElement>} */ (table.querySelectorAll('tr[data-child]')),
    )) {
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

  applyAll.onclick = () => {
    const amount = bulkAmount.value.trim();
    const group = bulkGroup.value;
    const status = bulkStatus.value;
    if (!amount && !group && !status) {
      showNotice('Completează o taxă, o grupă sau un statut de aplicat.', true);
      return;
    }
    for (const row of Array.from(
      /** @type {NodeListOf<HTMLTableRowElement>} */ (table.querySelectorAll('tr[data-child]')),
    )) {
      if (amount) /** @type {HTMLInputElement} */ (row.querySelector('[data-fee]')).value = amount;
      if (group) /** @type {HTMLSelectElement} */ (row.querySelector('[data-group]')).value = group;
      if (status) /** @type {HTMLSelectElement} */ (row.querySelector('[data-status]')).value = status;
    }
    showNotice('Valorile au fost puse pe rândurile afișate. Verifică excepțiile, apoi salvează.');
  };

  save.onclick = async () => {
    failure.textContent = '';
    try {
      const updates = collect();
      if (!updates.length) throw Error('Nu ai completat nicio taxă.');
      save.disabled = true;
      const result = await submitMutation('/api/children-setup', { updates });
      if (!result.warning) showNotice(`${updates.length} fișe completate. Verifică lista „De notificat”.`);
    } catch (error) {
      failure.textContent = /** @type {Error} */ (error).message;
      showNotice(/** @type {Error} */ (error).message, true);
    } finally {
      save.disabled = false;
    }
  };

  return { render };
}
