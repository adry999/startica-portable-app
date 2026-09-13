import { paymentTenders } from '../../shared/domain.mjs';
import { esc, money } from './dom.mjs';
import { session } from './session.mjs';
import { childNameOf } from '#shared/domain/record-labels.mjs';
import { listExpenseCategoryNames } from '#features/expenses/index.web.mjs';

export const expenseCategories = () => listExpenseCategoryNames(session.state);

export { pageIndexByList as pages, paginateRows as pageRows } from '#shared/ui/pagination.mjs';
export { recordActionButton as button, recordActions as actions } from '#shared/ui/record-actions.mjs';

export { sortTable } from '#shared/ui/table-sort.mjs';

export const childName = payment => childNameOf(payment, session.state.children);

export function parentContacts(c) {
  return (
    [
      [c.parent, c.phone],
      [c.parent2, c.phone2],
    ]
      .filter(pair => pair.some(Boolean))
      .map(([name, phone]) => `${esc(name || 'Nume necompletat')}${phone ? '<br>' + esc(phone) : ''}`)
      .join('<br>') || 'Necompletat'
  );
}

// Reutilizează culorile deja definite pentru achitări (verde/galben/roz).
const STATUS_BADGE_CLASS = { Activ: 'active', Suspendat: 'partial', Retras: 'late' };
export const statusBadgeClass = status => STATUS_BADGE_CLASS[status] || 'partial';

export function tenderLabel(p) {
  return paymentTenders(p)
    .map(part => `${esc(part.method)}: ${money(part.amount)}`)
    .join('<br>');
}

export { recordsSummaryMarkup as summaryHTML } from '#shared/ui/records-summary.mjs';

export function field(name, label, value = '', type = 'text', extra = '') {
  return `<label class="field">${label}<input name="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`;
}

// Valoarea curentă este adăugată la opțiuni chiar dacă nu este una dintre cele
// oferite, ca editarea unei fișe vechi să nu îi schimbe tăcut câmpul.
export function select(name, label, value, choices) {
  const options = [...new Set([value, ...choices])]
    .map(v => `<option value="${esc(v)}" ${v === value ? 'selected' : ''}>${esc(v || 'Neasociat')}</option>`)
    .join('');
  return `<label class="field">${label}<select name="${name}">${options}</select></label>`;
}

export function textarea(name, label, value) {
  return `<label class="field full">${label}<textarea name="${name}">${esc(value || '')}</textarea></label>`;
}
