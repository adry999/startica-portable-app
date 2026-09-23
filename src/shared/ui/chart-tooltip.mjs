import { formatMoney } from '#shared/format/money-format.mjs';

const MONTH_NAMES = [
  'Ianuarie',
  'Februarie',
  'Martie',
  'Aprilie',
  'Mai',
  'Iunie',
  'Iulie',
  'August',
  'Septembrie',
  'Octombrie',
  'Noiembrie',
  'Decembrie',
];

/**
 * @param {string} monthStr format YYYY-MM
 * @param {number} value
 */
export function formatBarTooltip(monthStr, value) {
  const [year, month] = monthStr.split('-').map(Number);
  const label = MONTH_NAMES[month - 1] ? `${MONTH_NAMES[month - 1]} ${year}` : monthStr;
  return `${label} · ${formatMoney(value)}`;
}

// Un singur element flotant, mutat lângă bara activă — nu unul per bară,
// ca tabelul de bare să rămână simplu de reconstruit la fiecare randare.
/**
 * @param {{ container: HTMLElement, barSelector?: string }} args
 */
export function createChartTooltip({ container, barSelector = '.bar' }) {
  // Ancorat pe părintele lui container, nu pe container însuși: randarea
  // reconstruiește bara cu innerHTML la fiecare actualizare și ar șterge tooltip-ul.
  const anchor = /** @type {HTMLElement} */ (container.parentElement);
  const tooltip = document.createElement('div');
  tooltip.className = 'chart-tooltip';
  tooltip.hidden = true;
  anchor.appendChild(tooltip);

  /** @param {HTMLElement} bar */
  function show(bar) {
    const month = bar.dataset.month;
    const value = Number(bar.dataset.value);
    if (!month) return;
    tooltip.textContent = formatBarTooltip(month, value);
    tooltip.hidden = false;
    const barRect = bar.getBoundingClientRect();
    const anchorRect = anchor.getBoundingClientRect();
    tooltip.style.left = `${barRect.left - anchorRect.left + barRect.width / 2}px`;
    tooltip.style.top = `${barRect.top - anchorRect.top}px`;
  }

  function hide() {
    tooltip.hidden = true;
  }

  /** @param {Event} event @returns {HTMLElement | null} */
  const barFrom = event => /** @type {HTMLElement} */ (event.target).closest?.(barSelector) ?? null;

  container.addEventListener('mouseover', event => {
    const bar = barFrom(event);
    if (bar) show(bar);
  });
  container.addEventListener('mouseout', event => {
    const bar = barFrom(event);
    const related = /** @type {MouseEvent} */ (event).relatedTarget;
    if (bar && !bar.contains(/** @type {Node | null} */ (related))) hide();
  });
  container.addEventListener('focusin', event => {
    const bar = barFrom(event);
    if (bar) show(bar);
  });
  container.addEventListener('focusout', event => {
    const bar = barFrom(event);
    const related = /** @type {FocusEvent} */ (event).relatedTarget;
    if (bar && !bar.contains(/** @type {Node | null} */ (related))) hide();
  });
}
