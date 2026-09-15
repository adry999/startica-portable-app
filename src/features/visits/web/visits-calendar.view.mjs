import { escapeHtml } from '#shared/format/html-escape.mjs';
import { monthCalendarMarkup } from '#shared/ui/month-calendar.mjs';
import { visitStatusChipClass } from './visit-labels.mjs';

/** @typedef {import('#shared/domain/month-grid.mjs').MonthGridDay} MonthGridDay */
/** @typedef {import('#shared/contracts/record-types.mjs').Visit} Visit */

/** @param {Visit} visit */
function chipHTML(visit) {
  return `<span class="cal-chip ${visitStatusChipClass(visit.status)}" data-visit-id="${escapeHtml(visit.id)}" title="${escapeHtml(visit.status)}">${escapeHtml(visit.time)} ${escapeHtml(visit.name)}</span>`;
}

/**
 * @param {MonthGridDay} day
 * @param {Map<string, Visit[]>} visitsByDate
 * @param {string | null} selectedDate
 */
function dayCellContent(day, visitsByDate, selectedDate) {
  const dayVisits = visitsByDate.get(day.date) || [];
  const chips = dayVisits.map(chipHTML).join('');
  const count = `${dayVisits.length} ${dayVisits.length === 1 ? 'vizită' : 'vizite'}`;
  const selectedClass = day.date === selectedDate ? ' is-selected' : '';
  return (
    `<button type="button" class="cal-day-hit${selectedClass}" data-date="${day.date}" aria-pressed="${day.date === selectedDate}">` +
    `<span class="cal-daynum">${day.day}</span>` +
    (chips ? `<div class="cal-chips">${chips}</div>` : '') +
    (dayVisits.length ? `<span class="cal-day-count">${count}</span>` : '') +
    `</button>`
  );
}

// Calendarul ecranului „Vizite”: cip pe fiecare zi, colorat după statut; sub
// 720px CSS ascunde cip-urile și arată doar numărul (vezi visits.css). Un
// clic pe zi restrânge lista la ziua aceea — al doilea clic o eliberează,
// decizia stă în `visits.controller.mjs`.
/**
 * @param {{ elements: { calendar: HTMLElement } }} dependencies
 */
export function createVisitsCalendarView({ elements: { calendar } }) {
  /**
   * @param {{
   *   weeks: MonthGridDay[][],
   *   visitsByDate: Map<string, Visit[]>,
   *   selectedDate: string | null,
   *   onSelectDate: (date: string) => void,
   *   onSelectVisit: (visitId: string) => void,
   * }} state
   */
  function render({ weeks, visitsByDate, selectedDate, onSelectDate, onSelectVisit }) {
    calendar.innerHTML = monthCalendarMarkup(weeks, day => dayCellContent(day, visitsByDate, selectedDate));
    calendar.onclick = event => {
      // Un cip e mereu în interiorul butonului zilei; verificat primul, ca
      // deschiderea detaliului să nu declanșeze și filtrarea pe ziua aceea.
      const chip = /** @type {HTMLElement} */ (event.target).closest('[data-visit-id]');
      if (chip) {
        onSelectVisit(/** @type {any} */ (chip).dataset.visitId);
        return;
      }
      const button = /** @type {HTMLElement} */ (event.target).closest('[data-date]');
      if (!button) return;
      onSelectDate(/** @type {any} */ (button).dataset.date);
    };
  }
  return { render };
}
