import { obligation, allocations, dueDayFor } from '../../shared/domain.mjs';
import { $, esc, money, date, age, monthLabel } from './dom.mjs';
import { session } from './session.mjs';
import { tenderLabel, parentContacts, statusBadgeClass } from './parts.mjs';
import { selectedMonth, contractOf } from './view-helpers.mjs';

// ─── Fișa copilului ─────────────────────────────────────────────────────────

const profileSection = (title, html) => `<section class="profile-section"><h4>${esc(title)}</h4>${html}</section>`;

function historyList(rows, render) {
  return rows.length
    ? `<ul class="history-list">${[...rows]
        .sort((a, b) => a.from.localeCompare(b.from))
        .map(r => `<li><strong>${esc(r.from)}</strong> ${render(r)}</li>`)
        .join('')}</ul>`
    : '<p class="muted">Fără istoric.</p>';
}

export function profile(id) {
  const c = session.state.children.find(r => r.id === id),
    payments = session.state.payments.filter(p => p.childId === id),
    month = selectedMonth(),
    o = obligation(c, month, payments);
  const paymentsRows =
    payments
      .map(
        p =>
          `<tr class="${p.archived ? 'archived-row' : ''}"><td>${date(p.date)}</td><td>${money(p.amount)}</td>` +
          `<td>${tenderLabel(p)}</td><td>${
            allocations(p)
              .map(a => `${esc(monthLabel(a.month))}: ${money(a.amount)}`)
              .join('<br>') || 'Avans nerepartizat'
          }</td></tr>`,
      )
      .join('') || `<tr><td colspan="4" class="empty">Fără achitări.</td></tr>`;
  $('profileBody').innerHTML =
    `<div class="profile-head"><div><h3>${esc(c.name)}</h3>` +
    `<span class="badge ${statusBadgeClass(c.status)}">${esc(c.status)}${c.archived ? ' · Arhivat' : ''}</span></div>` +
    `<p class="muted">Contract ${esc(contractOf(c))} · Grupa ${esc(session.state.groups.find(g => g.id === c.groupId)?.name || 'nealocată')} · Vârstă ${age(c.birthDate)}</p></div>` +
    `<div class="profile-grid">` +
    profileSection('Părinți', `<p>${parentContacts(c)}</p>`) +
    profileSection(
      'Contract',
      `<p>Contract: ${date(c.contractDate)}<br>Frecventare: ${date(c.attendanceDate)}<br>Retragere: ${date(c.withdrawalDate)}</p>`,
    ) +
    profileSection(
      'Taxă și scadență',
      `<p>Taxă curentă: ${o.expected === null ? 'necunoscută' : money(o.expected)}<br>Ziua scadenței: ${dueDayFor(c)}<br>Scadență luna ${esc(month)}: ${date(o.due)}</p>`,
    ) +
    profileSection(
      `Situație luna ${month}`,
      `<p>${esc(o.label)}<br>Rest: ${money(o.rest)} · Credit: ${money(o.credit)}</p>`,
    ) +
    `</div>` +
    profileSection(
      'Istoric taxe și statut',
      `<div class="profile-grid">` +
        profileSection(
          'Taxe',
          historyList(c.feeHistory || [], f => `— ${money(f.amount)}`),
        ) +
        profileSection(
          'Statut',
          historyList(c.statusHistory || [], s => `— ${esc(s.status)}`),
        ) +
        `</div>`,
    ) +
    profileSection('Achitări', `<div class="table-wrap"><table><tbody>${paymentsRows}</tbody></table></div>`) +
    (c.notes ? profileSection('Observații', `<p>${esc(c.notes)}</p>`) : '');
  $('profile').showModal();
}
