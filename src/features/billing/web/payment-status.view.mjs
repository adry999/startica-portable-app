import { escapeHtml } from '#shared/format/html-escape.mjs';
import { formatMoney } from '#shared/format/money-format.mjs';
import { formatDate } from '#shared/format/date-format.mjs';
import { contractNumberOf } from '#shared/domain/record-labels.mjs';
import { sortTable } from '#shared/ui/table-sort.mjs';
import { paginateRows } from '#shared/ui/pagination.mjs';

/** @typedef {import('../domain/month-evaluation.mjs').ChildMonthEvaluation} ChildMonthEvaluation */

const STATUS_COLUMNS = {
  contract: r => contractNumberOf(r.child),
  name: r => r.child.name,
  expected: r => r.obligation.expected,
  paid: r => r.obligation.paid,
  rest: r => r.obligation.rest,
  credit: r => r.obligation.credit,
  due: r => r.obligation.due,
  label: r => r.obligation.label,
};

/** @param {ChildMonthEvaluation} row */
function statusRowMarkup({ child, obligation }) {
  return (
    `<tr><td>${escapeHtml(contractNumberOf(child))}</td><td>${escapeHtml(child.name)}${child.archived ? ' (arhivat)' : ''}</td>` +
    `<td>${formatMoney(obligation.expected)}</td><td>${formatMoney(obligation.paid)}</td><td>${formatMoney(obligation.rest)}</td><td>${formatMoney(obligation.credit)}</td>` +
    `<td>${formatDate(obligation.due)}</td><td>${escapeHtml(obligation.label)}</td></tr>`
  );
}

/**
 * Ecranul „Situația plăților”: obligația fiecărui copil pe luna selectată,
 * inclusiv arhivați.
 * @param {{
 *   elements: { period: HTMLElement, table: HTMLTableSectionElement },
 *   readToday: () => string,
 *   requestRender: () => void,
 * }} dependencies
 * @returns {(context: { month: string, evaluations: ChildMonthEvaluation[] }) => void}
 */
export function createPaymentStatusView({ elements: { period, table }, readToday, requestRender }) {
  return function renderPaymentStatus({ month, evaluations }) {
    period.textContent = `Luna ${month} · situație la ${formatDate(readToday())}`;
    const sorted = sortTable('status', evaluations, STATUS_COLUMNS, requestRender);
    table.innerHTML =
      /** @type {ChildMonthEvaluation[]} */ (paginateRows('status', sorted))
        .map(row => statusRowMarkup(row))
        .join('') || '<tr><td colspan="8">Nu sunt copii.</td></tr>';
  };
}
