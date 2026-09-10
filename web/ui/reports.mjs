import { today, cents, cashSummary, allocations, monthCalendar, upcomingBirthdays } from '../../shared/domain.mjs';
import { $, esc, money, date, setNavCount } from './dom.mjs';
import { session } from './session.mjs';
import { pageRows, sortTable, button, parentContacts } from './parts.mjs';
import { contractOf, groupName } from './view-helpers.mjs';

// ─── Dashboard ──────────────────────────────────────────────────────────────

export function renderDashboard(month, cash, review, all) {
  $('incomeStat').textContent = money(cash.income);
  $('expenseStat').textContent = money(cash.expense);
  $('netStat').textContent = money(cash.net);
  $('incomeMethods').textContent = Object.entries(cash.byMethod)
    .filter(([method, value]) => method !== 'Altele' || value)
    .map(([method, value]) => `${method}: ${money(value)}`)
    .join(' · ');
  // Avans = partea dintr-o plată încasată, dar nerepartizată pe nicio lună.
  $('advanceStat').textContent = money(
    session.state.payments
      .filter(p => !p.archived && p.date <= today())
      .reduce((sum, p) => sum + cents(p.amount) - allocations(p).reduce((n, a) => n + cents(a.amount), 0), 0) / 100,
  );
  setNavCount('reviewCount', review.items.length);
  const upcomingBirthdayRows = upcomingBirthdays(session.state.children, 5);
  const upcomingBirthdayCount = upcomingBirthdayRows.length;
  const hasBirthdayToday = upcomingBirthdayRows.some(r => r.daysUntil === 0);
  $('birthdaysHighlightCount').textContent = (hasBirthdayToday ? '🎉 ' : '') + upcomingBirthdayCount;
  $('birthdaysHighlightDetail').textContent = upcomingBirthdayCount
    ? `${upcomingBirthdayCount} ${upcomingBirthdayCount === 1 ? 'copil' : 'copii'} în următoarele 5 zile`
    : 'Niciuna în următoarele 5 zile';
  const toNotify = all.filter(r => r.o.notify).length;
  const unassigned = session.state.payments.filter(p => !p.archived && !p.childId).length;
  const attentionItems = [
    {
      count: toNotify,
      icon: '!',
      title: 'Achitări de urmărit',
      detail: toNotify === 1 ? '1 copil trebuie notificat.' : `${toNotify} copii trebuie notificați.`,
      action: 'Vezi lista',
      view: 'notify',
      tone: 'urgent',
    },
    {
      count: review.items.length,
      icon: '✓',
      title: 'Înregistrări de verificat',
      detail:
        review.items.length === 1
          ? '1 fișă sau achitare necesită verificare.'
          : `${review.items.length} fișe sau achitări necesită verificare.`,
      action: 'Verifică',
      view: 'review',
      tone: 'review',
    },
    {
      count: unassigned,
      icon: '↗',
      title: 'Achitări neasociate',
      detail:
        unassigned === 1
          ? '1 achitare nu este legată de un copil.'
          : `${unassigned} achitări nu sunt legate de un copil.`,
      action: 'Asociază',
      view: 'assign',
      tone: 'assign',
    },
  ];
  const allClear = attentionItems.every(item => item.count === 0);
  $('alerts').innerHTML = allClear
    ? '<div class="attention-empty"><strong>Nicio acțiune în listele urmărite.</strong>' +
      (session.state.children.length || session.state.payments.length
        ? 'Nu există notificări, înregistrări de verificat sau achitări neasociate.'
        : 'Nu sunt copii sau achitări înregistrate încă.') +
      '</div>'
    : attentionItems
        .map(item => {
          const clear = item.count === 0;
          const detail = clear ? 'Nicio acțiune necesară pe această listă.' : item.detail;
          return `<article class="alert alert-${item.tone}${clear ? ' alert-clear' : ''}"><span class="alert-count">${item.count}</span><i aria-hidden="true">${item.icon}</i><div><strong>${item.title}</strong><small>${detail}</small></div><button class="alert-action" data-view="${item.view}">${clear ? 'Vezi lista' : item.action}<span aria-hidden="true">→</span></button></article>`;
        })
        .join('');

  const history = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(`${month}-15T12:00:00`);
    d.setMonth(d.getMonth() - i);
    const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    history.push({ month: m, value: cashSummary(session.state, m).income });
  }
  const max = Math.max(1, ...history.map(r => r.value));
  // Culoarea ține de luna calendaristică, nu de poziția din fereastra de 12
  // luni — altfel aceeași lună schimba culoare la fiecare mutare a lunii selectate.
  const BAR_COLORS = ['orange', 'yellow', 'mint'];
  $('bars').innerHTML = history
    .map(
      r =>
        `<div class="bar ${BAR_COLORS[Number(r.month.slice(5, 7)) % 3]}" title="${r.month}: ${money(r.value)}"><i style="height:${(r.value / max) * 100}%"></i><small>${r.month.slice(5)}</small></div>`,
    )
    .join('');

  renderBirthdays();
}

const CAL_WEEKDAYS = ['Lun', 'Mar', 'Mie', 'Joi', 'Vin', 'Sâm', 'Dum'];

function calendarCellHTML(cell) {
  const chips = cell.names
    .map(
      n =>
        `<span class="cal-chip" title="${esc(n.name)} · împlinește ${n.turningAge} ${n.turningAge === 1 ? 'an' : 'ani'}">${esc(n.name)}</span>`,
    )
    .join('');
  const cls = [
    'cal-cell',
    cell.inMonth ? '' : 'cal-outside',
    cell.isToday ? 'cal-today' : '',
    cell.isCurrentWeek ? 'cal-current-week' : '',
  ]
    .filter(Boolean)
    .join(' ');
  const confetti = cell.isToday && cell.names.length ? '<span class="cal-confetti" aria-hidden="true">🎉</span>' : '';
  return `<div class="${cls}">${confetti}<span class="cal-daynum">${cell.day}</span>${chips ? `<div class="cal-chips">${chips}</div>` : ''}</div>`;
}

// Calendar lunar cu adevărat, nu o listă: săptămâna curentă evidențiată prin
// fundalul rândului, ziua de naștere afișată direct pe ziua ei.
function birthdaysCalendarHTML(weeks) {
  const header = CAL_WEEKDAYS.map(l => `<div class="cal-weekday">${l}</div>`).join('');
  const cells = weeks.flat().map(calendarCellHTML).join('');
  return header + cells;
}

function upcomingBirthdayPillHTML(r) {
  const label = r.daysUntil === 0 ? 'azi' : r.daysUntil === 1 ? 'mâine' : `în ${r.daysUntil} zile`;
  const confetti = r.daysUntil === 0 ? '🎉 ' : '';
  return (
    `<span class="upcoming-pill${r.daysUntil === 0 ? ' is-today' : ''}">${confetti}${esc(r.child.name)}` +
    `<small>${label} · împlinește ${r.turningAge} ${r.turningAge === 1 ? 'an' : 'ani'}</small></span>`
  );
}

function renderBirthdays() {
  const upcoming = upcomingBirthdays(session.state.children, 5);
  $('birthdaysUpcoming').innerHTML =
    upcoming.map(upcomingBirthdayPillHTML).join('') ||
    '<p class="upcoming-empty">Nicio zi de naștere în următoarele 5 zile.</p>';
  $('birthdaysCalendar').innerHTML = birthdaysCalendarHTML(monthCalendar(session.state.children));
}

const STATUS_COLUMNS = {
  contract: r => contractOf(r.child),
  name: r => r.child.name,
  expected: r => r.o.expected,
  paid: r => r.o.paid,
  rest: r => r.o.rest,
  credit: r => r.o.credit,
  due: r => r.o.due,
  label: r => r.o.label,
};

export function renderStatus(month, all, rerender) {
  $('statusPeriod').textContent = `Luna ${month} · situație la ${date(today())}`;
  const sorted = sortTable('status', all, STATUS_COLUMNS, rerender);
  $('statusTable').innerHTML =
    pageRows('status', sorted)
      .map(({ child: c, o }) => {
        return (
          `<tr><td>${esc(contractOf(c))}</td><td>${esc(c.name)}${c.archived ? ' (arhivat)' : ''}</td>` +
          `<td>${money(o.expected)}</td><td>${money(o.paid)}</td><td>${money(o.rest)}</td><td>${money(o.credit)}</td>` +
          `<td>${date(o.due)}</td><td>${esc(o.label)}</td></tr>`
        );
      })
      .join('') || '<tr><td colspan="8">Nu sunt copii.</td></tr>';
}

// ─── De notificat ───────────────────────────────────────────────────────────

// Textul din coloana „Termen”, formulat din perspectiva persoanei care sună.
function termLabel(days) {
  if (days < 0) return `întârziere ${-days} ${-days === 1 ? 'zi' : 'zile'}`;
  if (days === 0) return 'scadent azi';
  return `în ${days} ${days === 1 ? 'zi' : 'zile'}`;
}

const NOTIFY_COLUMNS = {
  contract: r => contractOf(r.child),
  name: r => r.child.name,
  group: r => groupName(r.child.groupId),
  due: r => r.o.due,
  daysToDue: r => r.o.daysToDue,
  expected: r => r.o.expected,
  paid: r => r.o.paid,
  rest: r => r.o.rest,
  label: r => r.o.label,
};

export function renderNotify(month, all, unassignedByChild, rerender) {
  const notified = all.filter(r => r.o.notify);
  // Implicit: întârzierea cea mai veche prima — costă cel mai mult dacă mai
  // așteaptă. Un click pe un antet suprascrie asta cu sortarea manuală.
  const rows = sortTable(
    'notify',
    [...notified].sort((a, b) => a.o.daysToDue - b.o.daysToDue || a.child.name.localeCompare(b.child.name, 'ro')),
    NOTIFY_COLUMNS,
    rerender,
  );

  const late = notified.filter(r => r.o.daysToDue < 0);
  const soon = notified.filter(r => r.o.daysToDue >= 0);
  const owed = notified.reduce((sum, r) => sum + cents(r.o.rest), 0) / 100;
  // Fișele fără taxă sau fără perioadă confirmată nu pot fi evaluate deloc;
  // fără cifra asta, un „0 de notificat” ar părea liniștitor pe nedrept.
  const unknown = all.filter(r => r.o.label === 'De verificat').length;

  setNavCount('notifyCount', notified.length);
  $('notifyPeriod').textContent = `Luna ${month} · situație la ${date(today())}`;
  $('notifyStats').innerHTML =
    `<article class="card pink"><p>Cu întârziere</p><strong>${late.length}</strong><small>scadența a trecut</small></article>` +
    `<article class="card yellow"><p>Nescadente încă</p><strong>${soon.length}</strong><small>de plată, dar scadența n-a trecut</small></article>` +
    `<article class="card orange"><p>Sumă de încasat</p><strong>${money(owed)}</strong><small>total pe lista de mai jos</small></article>` +
    `<article class="card mint"><p>Nu pot fi evaluați</p><strong>${unknown}</strong><small>fără taxă sau perioadă confirmată</small></article>`;

  $('notifyTable').innerHTML =
    rows
      .map(({ child: c, o }) => {
        // Plata poate sta needentificată în Asociere achitări: fără semnalul
        // ăsta, operatorul ar suna un părinte care de fapt a plătit deja.
        const hint = unassignedByChild.has(c.id)
          ? ` <button type="button" class="hint-link" data-view="assign">posibilă plată neasociată</button>`
          : '';
        return (
          `<tr class="${o.daysToDue < 0 ? 'late-row' : ''}"><td>${esc(contractOf(c))}</td>` +
          `<td>${button('profile', 'children', c.id, c.name)}</td><td>${parentContacts(c)}</td>` +
          `<td>${esc(groupName(c.groupId) || '—')}</td><td>${date(o.due)}</td><td>${esc(termLabel(o.daysToDue))}</td>` +
          `<td>${money(o.expected)}</td><td>${money(o.paid)}</td><td><strong>${money(o.rest)}</strong></td>` +
          `<td>${esc(o.label)}${hint}</td></tr>`
        );
      })
      .join('') ||
    `<tr><td colspan="10" class="empty">${
      unknown
        ? 'Nimeni de notificat, dar ' + unknown + ' fișe nu pot fi evaluate. Completează taxa și perioada.'
        : 'Nimeni de notificat pentru luna aceasta.'
    }</td></tr>`;
}
