/** @typedef {import('#shared/domain/month-grid.mjs').MonthGridDay} MonthGridDay */

const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mie', 'Joi', 'Vin', 'Sâm', 'Dum'];

/**
 * @param {MonthGridDay} day
 * @param {(day: MonthGridDay) => string} renderCellContent
 */
function cellHTML(day, renderCellContent) {
  const cls = [
    'cal-cell',
    day.inMonth ? '' : 'cal-outside',
    day.isToday ? 'cal-today' : '',
    day.isCurrentWeek ? 'cal-current-week' : '',
  ]
    .filter(Boolean)
    .join(' ');
  return `<div class="${cls}">${renderCellContent(day)}</div>`;
}

// Antetul zilelor și celulele unui calendar lunar; conținutul fiecărei
// celule e specific consumatorului (zile de naștere, vizite), venit din
// callback, ca markup-ul grilei să rămână o singură dată.
/**
 * @param {MonthGridDay[][]} weeks
 * @param {(day: MonthGridDay) => string} renderCellContent
 */
export function monthCalendarMarkup(weeks, renderCellContent) {
  const header = WEEKDAY_LABELS.map(label => `<div class="cal-weekday">${label}</div>`).join('');
  const cells = weeks
    .flat()
    .map(day => cellHTML(day, renderCellContent))
    .join('');
  return header + cells;
}
