import { escapeHtml } from '#shared/format/html-escape.mjs';
import { formatMoney } from '#shared/format/money-format.mjs';
import { formatDate } from '#shared/format/date-format.mjs';
import { formatParentContacts } from '#shared/format/parent-contacts-format.mjs';
import { cents } from '#shared/domain/money.mjs';
import { contractNumberOf, groupNameOf } from '#shared/domain/record-labels.mjs';
import { recordActionButton } from '#shared/ui/record-actions.mjs';
import { sortTable } from '#shared/ui/table-sort.mjs';

/** @typedef {import('#shared/contracts/record-types.mjs').RecordsSnapshot} RecordsSnapshot */
/** @typedef {import('#shared/contracts/record-types.mjs').Group} Group */
/** @typedef {import('../domain/month-evaluation.mjs').ChildMonthEvaluation} ChildMonthEvaluation */

// Textul din coloana „Termen”, formulat din perspectiva persoanei care sună.
function termLabel(days) {
  if (days < 0) return `întârziere ${-days} ${-days === 1 ? 'zi' : 'zile'}`;
  if (days === 0) return 'scadent azi';
  return `în ${days} ${days === 1 ? 'zi' : 'zile'}`;
}

/** @param {Group[]} groups */
function notifyColumns(groups) {
  return {
    contract: r => contractNumberOf(r.child),
    name: r => r.child.name,
    group: r => groupNameOf(r.child.groupId, groups),
    due: r => r.obligation.due,
    daysToDue: r => r.obligation.daysToDue,
    expected: r => r.obligation.expected,
    paid: r => r.obligation.paid,
    rest: r => r.obligation.rest,
    label: r => r.obligation.label,
  };
}

/**
 * Ecranul „De notificat”: copiii cu rest de plată, sortați implicit după
 * întârzierea cea mai veche.
 * @param {{
 *   elements: { period: HTMLElement, stats: HTMLElement, table: HTMLTableSectionElement },
 *   readRecords: () => RecordsSnapshot,
 *   readToday: () => string,
 *   requestRender: () => void,
 *   renderNotifyCount: (count: number) => void,
 * }} dependencies
 * @returns {(context: { month: string, evaluations: ChildMonthEvaluation[], unassignedPaymentHintsByChild: Map<string, unknown> }) => void}
 */
export function createNotifyListView({
  elements: { period, stats, table },
  readRecords,
  readToday,
  requestRender,
  renderNotifyCount,
}) {
  return function renderNotifyList({ month, evaluations, unassignedPaymentHintsByChild }) {
    const { groups } = readRecords();
    const notified = evaluations.filter(r => r.obligation.notify);
    // Implicit: întârzierea cea mai veche prima — costă cel mai mult dacă mai
    // așteaptă. Un click pe un antet suprascrie asta cu sortarea manuală.
    const rows = sortTable(
      'notify',
      [...notified].sort(
        (a, b) => a.obligation.daysToDue - b.obligation.daysToDue || a.child.name.localeCompare(b.child.name, 'ro'),
      ),
      notifyColumns(groups),
      requestRender,
    );

    const late = notified.filter(r => r.obligation.daysToDue < 0);
    const soon = notified.filter(r => r.obligation.daysToDue >= 0);
    const owed = notified.reduce((sum, r) => sum + cents(r.obligation.rest), 0) / 100;
    // Fișele fără taxă sau fără perioadă confirmată nu pot fi evaluate deloc;
    // fără cifra asta, un „0 de notificat” ar părea liniștitor pe nedrept.
    const unknown = evaluations.filter(r => r.obligation.label === 'De verificat').length;

    renderNotifyCount(notified.length);
    period.textContent = `Luna ${month} · situație la ${formatDate(readToday())}`;
    stats.innerHTML =
      `<article class="card pink"><p>Cu întârziere</p><strong>${late.length}</strong><small>scadența a trecut</small></article>` +
      `<article class="card yellow"><p>Nescadente încă</p><strong>${soon.length}</strong><small>de plată, dar scadența n-a trecut</small></article>` +
      `<article class="card orange"><p>Sumă de încasat</p><strong>${formatMoney(owed)}</strong><small>total pe lista de mai jos</small></article>` +
      `<article class="card mint"><p>Nu pot fi evaluați</p><strong>${unknown}</strong><small>fără taxă sau perioadă confirmată</small></article>`;

    table.innerHTML =
      rows
        .map(({ child, obligation }) => {
          // Plata poate sta needentificată în Asociere achitări: fără semnalul
          // ăsta, operatorul ar suna un părinte care de fapt a plătit deja.
          const hint = unassignedPaymentHintsByChild.has(child.id)
            ? ` <button type="button" class="hint-link" data-view="assign">posibilă plată neasociată</button>`
            : '';
          return (
            `<tr class="${obligation.daysToDue < 0 ? 'late-row' : ''}"><td>${escapeHtml(contractNumberOf(child))}</td>` +
            `<td>${recordActionButton('profile', 'children', child.id, child.name)}</td><td>${formatParentContacts(child)}</td>` +
            `<td>${escapeHtml(groupNameOf(child.groupId, groups) || '—')}</td><td>${formatDate(obligation.due)}</td><td>${escapeHtml(termLabel(obligation.daysToDue))}</td>` +
            `<td>${formatMoney(obligation.expected)}</td><td>${formatMoney(obligation.paid)}</td><td><strong>${formatMoney(obligation.rest)}</strong></td>` +
            `<td>${escapeHtml(obligation.label)}${hint}</td></tr>`
          );
        })
        .join('') ||
      `<tr><td colspan="10" class="empty">${
        unknown
          ? 'Nimeni de notificat, dar ' + unknown + ' fișe nu pot fi evaluate. Completează taxa și perioada.'
          : 'Nimeni de notificat pentru luna aceasta.'
      }</td></tr>`;
  };
}
