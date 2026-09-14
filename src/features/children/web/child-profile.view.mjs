import { escapeHtml } from '#shared/format/html-escape.mjs';
import { formatMoney } from '#shared/format/money-format.mjs';
import { formatDate, formatMonthLabel, formatAge } from '#shared/format/date-format.mjs';
import { formatPaymentTenders } from '#shared/format/payment-tenders-format.mjs';
import { allocations } from '#shared/domain/payment-allocations.mjs';
import { obligation, dueDayFor } from '#shared/domain/tuition-obligation.mjs';
import { formatParentContacts } from '#shared/format/parent-contacts-format.mjs';
import { statusBadgeClass } from './child-labels.mjs';
import { contractNumberOf } from '#shared/domain/record-labels.mjs';

/** @typedef {import('#shared/contracts/record-types.mjs').RecordsSnapshot} RecordsSnapshot */
/** @typedef {import('#shared/contracts/record-types.mjs').Child} Child */

const profileSection = (title, html) =>
  `<section class="profile-section"><h4>${escapeHtml(title)}</h4>${html}</section>`;

/**
 * @param {{ from: string }[]} rows
 * @param {(row: any) => string} render
 */
function historyList(rows, render) {
  return rows.length
    ? `<ul class="history-list">${[...rows]
        .sort((a, b) => a.from.localeCompare(b.from))
        .map(row => `<li><strong>${escapeHtml(row.from)}</strong> ${render(row)}</li>`)
        .join('')}</ul>`
    : '<p class="muted">Fără istoric.</p>';
}

/**
 * @param {{
 *   elements: { body: HTMLElement, dialog: HTMLDialogElement },
 *   readRecords: () => RecordsSnapshot,
 *   readSelectedMonth: () => string,
 * }} dependencies
 */
export function createChildProfileView({ elements: { body, dialog }, readRecords, readSelectedMonth }) {
  /** @param {string} childId */
  function openChildProfile(childId) {
    const records = readRecords();
    const child = /** @type {Child} */ (records.children.find(c => c.id === childId));
    const payments = records.payments.filter(p => p.childId === childId);
    const month = readSelectedMonth();
    const childObligation = obligation(child, month, payments);
    const paymentsRows =
      payments
        .map(
          p =>
            `<tr class="${p.archived ? 'archived-row' : ''}"><td>${formatDate(p.date)}</td><td>${formatMoney(p.amount)}</td>` +
            `<td>${formatPaymentTenders(p)}</td><td>${
              allocations(p)
                .map(a => `${escapeHtml(formatMonthLabel(a.month))}: ${formatMoney(a.amount)}`)
                .join('<br>') || 'Avans nerepartizat'
            }</td></tr>`,
        )
        .join('') || `<tr><td colspan="4" class="empty">Fără achitări.</td></tr>`;
    body.innerHTML =
      `<div class="profile-head"><div><h3>${escapeHtml(child.name)}</h3>` +
      `<span class="badge ${statusBadgeClass(child.status)}">${escapeHtml(child.status)}${child.archived ? ' · Arhivat' : ''}</span></div>` +
      `<p class="muted">Contract ${escapeHtml(contractNumberOf(child))} · Grupa ${escapeHtml(records.groups.find(g => g.id === child.groupId)?.name || 'nealocată')} · Vârstă ${formatAge(child.birthDate)}</p></div>` +
      `<div class="profile-grid">` +
      profileSection('Părinți', `<p>${formatParentContacts(child)}</p>`) +
      profileSection(
        'Contract',
        `<p>Contract: ${formatDate(child.contractDate)}<br>Frecventare: ${formatDate(child.attendanceDate)}<br>Retragere: ${formatDate(child.withdrawalDate)}</p>`,
      ) +
      profileSection(
        'Taxă și scadență',
        `<p>Taxă curentă: ${childObligation.expected === null ? 'necunoscută' : formatMoney(childObligation.expected)}<br>Ziua scadenței: ${dueDayFor(child)}<br>Scadență luna ${escapeHtml(month)}: ${formatDate(childObligation.due)}</p>`,
      ) +
      profileSection(
        `Situație luna ${month}`,
        `<p>${escapeHtml(childObligation.label)}<br>Rest: ${formatMoney(childObligation.rest)} · Credit: ${formatMoney(childObligation.credit)}</p>`,
      ) +
      `</div>` +
      profileSection(
        'Istoric taxe și statut',
        `<div class="profile-grid">` +
          profileSection(
            'Taxe',
            historyList(child.feeHistory || [], f => `— ${formatMoney(f.amount)}`),
          ) +
          profileSection(
            'Statut',
            historyList(child.statusHistory || [], s => `— ${escapeHtml(s.status)}`),
          ) +
          `</div>`,
      ) +
      profileSection('Achitări', `<div class="table-wrap"><table><tbody>${paymentsRows}</tbody></table></div>`) +
      (child.notes ? profileSection('Observații', `<p>${escapeHtml(child.notes)}</p>`) : '');
    dialog.showModal();
  }

  return { openChildProfile };
}
