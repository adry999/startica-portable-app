import { escapeHtml } from '#shared/format/html-escape.mjs';
import { formatMoney } from '#shared/format/money-format.mjs';
import { cents, total } from '#shared/domain/money.mjs';

// Port 1:1 al repartizării pe luni din fostul web/ui/editor.mjs
// (addAllocation, readAllocations, allocationBalance).

/** @param {HTMLElement} rowsContainer */
export function readAllocationRows(rowsContainer) {
  return Array.from(rowsContainer.children).map(row => ({
    month: /** @type {HTMLInputElement} */ (row.querySelector('[data-month]')).value,
    amount: Number(/** @type {HTMLInputElement} */ (row.querySelector('[data-amount]')).value),
  }));
}

/**
 * @param {{ formElement: HTMLFormElement, rowsContainer: HTMLElement, balanceElement: HTMLElement }} elements
 * @param {any} context RecordEditorContext (din #features/record-editing, neimportat aici)
 */
export function renderAllocationBalance(elements, context) {
  if (!elements.rowsContainer) return;
  const amount = Number(/** @type {HTMLInputElement} */ (elements.formElement.elements.namedItem('amount')).value);
  const allocated = total(readAllocationRows(elements.rowsContainer));
  elements.balanceElement.textContent = `Repartizat: ${formatMoney(allocated)} · Nerepartizat: ${formatMoney((cents(amount) - cents(allocated)) / 100)}`;
  context.renderSaveStatus();
}

/**
 * @param {{ formElement: HTMLFormElement, rowsContainer: HTMLElement, balanceElement: HTMLElement }} elements
 * @param {{ month: string, amount: string | number }} allocation
 * @param {any} context RecordEditorContext (din #features/record-editing, neimportat aici)
 */
export function addAllocationRow(elements, allocation, context) {
  context.markDirty();
  const row = document.createElement('div');
  row.className = 'allocation';
  row.innerHTML =
    `<label>Luna<input type="month" data-month value="${escapeHtml(allocation.month)}" required></label>` +
    `<label>Suma<input type="number" data-amount value="${escapeHtml(allocation.amount)}" min="0.01" step="0.01" required></label>` +
    `<button type="button" class="action-btn" aria-label="Elimină repartizarea">×</button>`;
  /** @type {HTMLButtonElement} */ (row.querySelector('button')).onclick = () => {
    context.markDirty();
    row.remove();
    renderAllocationBalance(elements, context);
  };
  row.oninput = () => renderAllocationBalance(elements, context);
  elements.rowsContainer.append(row);
  renderAllocationBalance(elements, context);
}
