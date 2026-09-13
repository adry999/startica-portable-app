import { today } from '#shared/domain/calendar-month.mjs';

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
 * @typedef {{
 *   selectedMonth: HTMLInputElement,
 *   selectedMonthLabel: HTMLElement,
 *   monthTrigger: HTMLElement,
 *   monthMenu: HTMLElement,
 *   monthYear: HTMLElement,
 *   monthOptions: HTMLElement,
 *   monthPrevYear: HTMLElement,
 *   monthNextYear: HTMLElement,
 *   monthControl: HTMLElement,
 * }} MonthPickerElements
 */

let monthPickerYear;
/** @type {MonthPickerElements | null} */
let boundElements = null;

function requireElements() {
  if (!boundElements) throw new Error('bindMonthPicker() trebuie apelat înainte de closeMonthPicker().');
  return boundElements;
}

// Exportată separat: alte module (formularele care se deschid peste calendar) o pot închide.
export function closeMonthPicker() {
  const elements = requireElements();
  elements.monthMenu.hidden = true;
  elements.monthTrigger.setAttribute('aria-expanded', 'false');
}

/** @param {string} value */
function monthParts(value) {
  const [year, month] = value.split('-').map(Number);
  return { year, month };
}

/** @param {EventTarget | null} target */
function findMonthOption(target) {
  if (!(target instanceof HTMLElement)) return null;
  return /** @type {HTMLElement | null} */ (target.closest('[data-month]'));
}

/** @param {MonthPickerElements} elements */
function renderMonthPicker(elements) {
  const { year, month } = monthParts(elements.selectedMonth.value);
  if (!monthPickerYear) monthPickerYear = year;
  elements.selectedMonthLabel.textContent = `${MONTH_NAMES[month - 1]} ${year}`;
  elements.monthYear.textContent = String(monthPickerYear);
  elements.monthOptions.innerHTML = MONTH_NAMES.map((name, index) => {
    const value = `${monthPickerYear}-${String(index + 1).padStart(2, '0')}`;
    return `<button class="month-option" type="button" role="option" data-month="${value}" aria-selected="${value === elements.selectedMonth.value}">${name.slice(0, 3)}</button>`;
  }).join('');
}

/** @param {MonthPickerElements} elements */
function focusSelectedMonth(elements) {
  const options = /** @type {HTMLElement[]} */ (Array.from(elements.monthOptions.querySelectorAll('[data-month]')));
  const selected = options.find(option => option.getAttribute('aria-selected') === 'true');
  (selected ?? options[0])?.focus();
}

/**
 * @param {{ byId: (id: string) => HTMLElement, onMonthChange: () => void }} dependencies
 */
export function bindMonthPicker({ byId, onMonthChange }) {
  const elements = /** @type {MonthPickerElements} */ ({
    selectedMonth: byId('selectedMonth'),
    selectedMonthLabel: byId('selectedMonthLabel'),
    monthTrigger: byId('monthTrigger'),
    monthMenu: byId('monthMenu'),
    monthYear: byId('monthYear'),
    monthOptions: byId('monthOptions'),
    monthPrevYear: byId('monthPrevYear'),
    monthNextYear: byId('monthNextYear'),
    monthControl: byId('monthControl'),
  });
  boundElements = elements;

  elements.selectedMonth.value = today().slice(0, 7);
  monthPickerYear = monthParts(elements.selectedMonth.value).year;
  renderMonthPicker(elements);
  elements.selectedMonth.onchange = () => {
    if (!elements.selectedMonth.value) elements.selectedMonth.value = today().slice(0, 7);
    monthPickerYear = monthParts(elements.selectedMonth.value).year;
    renderMonthPicker(elements);
    onMonthChange();
  };
  elements.monthTrigger.onclick = () => {
    const opening = elements.monthMenu.hidden;
    elements.monthMenu.hidden = !opening;
    elements.monthTrigger.setAttribute('aria-expanded', String(opening));
    if (opening) renderMonthPicker(elements);
  };
  elements.monthTrigger.onkeydown = event => {
    if (!['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    if (elements.monthMenu.hidden) elements.monthTrigger.click();
    focusSelectedMonth(elements);
  };
  elements.monthPrevYear.onclick = () => {
    monthPickerYear--;
    renderMonthPicker(elements);
  };
  elements.monthNextYear.onclick = () => {
    monthPickerYear++;
    renderMonthPicker(elements);
  };
  elements.monthOptions.onclick = event => {
    const option = findMonthOption(event.target);
    if (!option) return;
    elements.selectedMonth.value = option.dataset.month ?? '';
    elements.selectedMonth.dispatchEvent(new Event('change'));
    closeMonthPicker();
  };
  elements.monthOptions.onkeydown = event => {
    const option = findMonthOption(event.target);
    if (!option) return;
    const options = /** @type {HTMLElement[]} */ (Array.from(elements.monthOptions.querySelectorAll('[data-month]')));
    const index = options.indexOf(option);
    const offsets = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 3, ArrowUp: -3 };
    let next = null;
    if (event.key in offsets)
      next =
        options[(index + offsets[/** @type {keyof typeof offsets} */ (event.key)] + options.length) % options.length];
    if (event.key === 'Home') next = options[0];
    if (event.key === 'End') next = options.at(-1);
    if (!next) return;
    event.preventDefault();
    next.focus();
  };
  document.addEventListener('click', event => {
    if (!(event.target instanceof Node) || !elements.monthControl.contains(event.target)) closeMonthPicker();
  });
  // Înregistrat înaintea navigației mobile: dacă închide calendarul, oprește
  // propagarea ca Escape să nu închidă și panoul de navigație în același pas.
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    const pickerWasOpen = !elements.monthMenu.hidden;
    closeMonthPicker();
    if (pickerWasOpen) {
      elements.monthTrigger.focus();
      event.stopImmediatePropagation();
    }
  });
}
