import { escapeHtml } from '#shared/format/html-escape.mjs';
import { formatMoney } from '#shared/format/money-format.mjs';
import { summarizeCashForMonth, sumUnallocatedAdvance } from '../domain/cash-summary.mjs';

/** @typedef {import('#shared/contracts/record-types.mjs').RecordsSnapshot} RecordsSnapshot */
/** @typedef {import('#shared/contracts/record-types.mjs').Child} Child */
/** @typedef {{ child: Child, daysUntil: number, turningAge: number }} UpcomingBirthday */
/** @typedef {{ child: Child, obligation: { notify: boolean } }} ChildMonthEvaluationLike */
/** @typedef {{ items: { length: number } }} ReviewCenterLike */

const CAL_WEEKDAYS = ['Lun', 'Mar', 'Mie', 'Joi', 'Vin', 'Sâm', 'Dum'];
// Culoarea ține de luna calendaristică, nu de poziția din fereastra de 12
// luni — altfel aceeași lună schimba culoare la fiecare mutare a lunii selectate.
const BAR_COLORS = ['orange', 'yellow', 'mint'];

function calendarCellHTML(cell) {
  const chips = cell.names
    .map(
      n =>
        `<span class="cal-chip" title="${escapeHtml(n.name)} · împlinește ${n.turningAge} ${n.turningAge === 1 ? 'an' : 'ani'}">${escapeHtml(n.name)}</span>`,
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

/** @param {UpcomingBirthday} r */
function upcomingBirthdayPillHTML(r) {
  const label = r.daysUntil === 0 ? 'azi' : r.daysUntil === 1 ? 'mâine' : `în ${r.daysUntil} zile`;
  const confetti = r.daysUntil === 0 ? '🎉 ' : '';
  return (
    `<span class="upcoming-pill${r.daysUntil === 0 ? ' is-today' : ''}">${confetti}${escapeHtml(r.child.name)}` +
    `<small>${label} · împlinește ${r.turningAge} ${r.turningAge === 1 ? 'an' : 'ani'}</small></span>`
  );
}

/**
 * Ecranul „Dashboard”: cardurile de încasări, alertele de urmărit, istoricul
 * de venituri pe 12 luni și panoul zilelor de naștere. Înlocuiește
 * `renderDashboard`/`renderBirthdays` din `web/ui/reports.mjs`.
 * @param {{
 *   elements: {
 *     incomeStat: HTMLElement, expenseStat: HTMLElement, netStat: HTMLElement, incomeMethods: HTMLElement,
 *     advanceStat: HTMLElement, alerts: HTMLElement, bars: HTMLElement,
 *     birthdaysHighlightCount: HTMLElement, birthdaysHighlightDetail: HTMLElement,
 *     birthdaysUpcoming: HTMLElement, birthdaysCalendar: HTMLElement,
 *   },
 *   readRecords: () => RecordsSnapshot,
 *   readToday: () => string,
 *   listUpcomingBirthdays: (children: Child[], days?: number, todayStr?: string) => UpcomingBirthday[],
 *   buildBirthdayCalendar: (children: Child[], todayStr?: string) => unknown[][],
 *   renderReviewCount: (count: number) => void,
 * }} dependencies
 * @returns {(context: { month: string, review: ReviewCenterLike, evaluations: ChildMonthEvaluationLike[] }) => void}
 */
export function createDashboardView({
  elements: {
    incomeStat,
    expenseStat,
    netStat,
    incomeMethods,
    advanceStat,
    alerts,
    bars,
    birthdaysHighlightCount,
    birthdaysHighlightDetail,
    birthdaysUpcoming,
    birthdaysCalendar,
  },
  readRecords,
  readToday,
  listUpcomingBirthdays,
  buildBirthdayCalendar,
  renderReviewCount,
}) {
  /** @param {Child[]} children */
  function renderBirthdays(children) {
    const upcoming = listUpcomingBirthdays(children, 5);
    birthdaysUpcoming.innerHTML =
      upcoming.map(upcomingBirthdayPillHTML).join('') ||
      '<p class="upcoming-empty">Nicio zi de naștere în următoarele 5 zile.</p>';
    birthdaysCalendar.innerHTML = birthdaysCalendarHTML(buildBirthdayCalendar(children));
  }

  return function renderDashboard({ month, review, evaluations }) {
    const records = readRecords();
    const cash = summarizeCashForMonth(records, month);
    incomeStat.textContent = formatMoney(cash.income);
    expenseStat.textContent = formatMoney(cash.expense);
    netStat.textContent = formatMoney(cash.net);
    incomeMethods.textContent = Object.entries(cash.byMethod)
      .filter(([method, value]) => method !== 'Altele' || value)
      .map(([method, value]) => `${method}: ${formatMoney(value)}`)
      .join(' · ');
    // Avans = partea dintr-o plată încasată, dar nerepartizată pe nicio lună.
    advanceStat.textContent = formatMoney(sumUnallocatedAdvance(records.payments, readToday()));
    renderReviewCount(review.items.length);
    const upcomingBirthdayRows = listUpcomingBirthdays(records.children, 5);
    const upcomingBirthdayCount = upcomingBirthdayRows.length;
    const hasBirthdayToday = upcomingBirthdayRows.some(r => r.daysUntil === 0);
    birthdaysHighlightCount.textContent = (hasBirthdayToday ? '🎉 ' : '') + upcomingBirthdayCount;
    birthdaysHighlightDetail.textContent = upcomingBirthdayCount
      ? `${upcomingBirthdayCount} ${upcomingBirthdayCount === 1 ? 'copil' : 'copii'} în următoarele 5 zile`
      : 'Niciuna în următoarele 5 zile';
    const toNotify = evaluations.filter(r => r.obligation.notify).length;
    const unassigned = records.payments.filter(p => !p.archived && !p.childId).length;
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
    alerts.innerHTML = allClear
      ? '<div class="attention-empty"><strong>Nicio acțiune în listele urmărite.</strong>' +
        (records.children.length || records.payments.length
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
      history.push({ month: m, value: summarizeCashForMonth(records, m).income });
    }
    const max = Math.max(1, ...history.map(r => r.value));
    bars.innerHTML = history
      .map(
        r =>
          `<div class="bar ${BAR_COLORS[Number(r.month.slice(5, 7)) % 3]}" title="${r.month}: ${formatMoney(r.value)}"><i style="height:${(r.value / max) * 100}%"></i><small>${r.month.slice(5)}</small></div>`,
      )
      .join('');

    renderBirthdays(records.children);
  };
}
