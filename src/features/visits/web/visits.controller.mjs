import { formatMonthName } from '#shared/format/date-format.mjs';
import { normalizeSearchText } from '#shared/format/text-search.mjs';
import { escapeHtml } from '#shared/format/html-escape.mjs';
import { VISIT_STATUSES } from '#shared/domain/record-schema.mjs';
import { buildMonthGrid } from '#shared/domain/month-grid.mjs';
import { groupNameOf } from '#shared/domain/record-labels.mjs';
import { matchesRecordListSearch } from '#shared/ui/record-list-search.mjs';
import { sortListRows, applyManualSort } from '#shared/ui/record-list-sort.mjs';
import { summarizeVisitFunnel, countVisitsForDays } from '../domain/visit-statistics.mjs';
import { applyVisitStatus } from '../domain/visit-status.mjs';
import { buildChildPrefill } from '../domain/visit-child-prefill.mjs';
import { createVisitsListView } from './visits-list.view.mjs';
import { createVisitsCalendarView } from './visits-calendar.view.mjs';

/** @typedef {import('#shared/contracts/record-types.mjs').RecordsSnapshot} RecordsSnapshot */
/** @typedef {import('#shared/contracts/record-types.mjs').Visit} Visit */
/** @typedef {import('#shared/ui/record-list-sort.mjs').ListSortState} ListSortState */

const ALLOWED_SORT_FIELDS = ['date', 'time', 'name', 'parent', 'status', 'group'];

/** @param {Date} date */
const isoDateOf = date =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/**
 * @param {string} monthKey format YYYY-MM
 * @param {number} delta
 */
function shiftMonthKey(monthKey, delta) {
  const [year, month] = monthKey.split('-').map(Number);
  const shifted = new Date(year, month - 1 + delta, 1);
  return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, '0')}`;
}

// Sortarea implicită e dată+oră (nu doar oră, ca la countVisitsForDays): un
// câmp compus, ca zilele diferite cu aceeași oră să nu se amestece.
/**
 * @param {string} field
 * @param {Visit} row
 * @param {RecordsSnapshot} records
 */
function readVisitSortValue(field, row, records) {
  if (field === 'date') return `${row.date} ${row.time}`;
  if (field === 'group') return groupNameOf(row.desiredGroupId, records.groups);
  return row[field] || '';
}

/**
 * Ecranul „Vizite”: calendar, listă filtrată, pâlnie de statistici și
 * pornirea înscrierii unui copil dintr-o vizită efectuată.
 * @param {{
 *   elements: {
 *     funnel: HTMLElement,
 *     calendar: HTMLElement,
 *     prevMonthButton: HTMLElement,
 *     nextMonthButton: HTMLElement,
 *     monthLabel: HTMLElement,
 *     todayButton: HTMLElement,
 *     search: HTMLInputElement,
 *     statusFilter: HTMLSelectElement,
 *     allMonthsCheckbox: HTMLInputElement,
 *     archiveCheckbox: HTMLInputElement,
 *     head: HTMLTableSectionElement,
 *     table: HTMLTableSectionElement,
 *     summaryText: HTMLElement,
 *   },
 *   readRecords: () => RecordsSnapshot,
 *   readNow: () => Date,
 *   submitMutation: (path: string, body: Record<string, unknown>) => Promise<unknown>,
 *   showNotice: (message: string, isError?: boolean) => void,
 *   openEditor: (type: 'children', id?: string, options?: { prefill?: object, submit?: (record: any) => Promise<unknown>, title?: string }) => void,
 *   enrolChild: (visitId: string, child: unknown) => Promise<unknown>,
 *   openProfile: (childId: string) => void,
 *   renderVisitsCount?: (count: number) => void,
 * }} dependencies
 */
export function createVisitsController({
  elements: {
    funnel,
    calendar,
    prevMonthButton,
    nextMonthButton,
    monthLabel,
    todayButton,
    search,
    statusFilter,
    allMonthsCheckbox,
    archiveCheckbox,
    head,
    table,
    summaryText,
  },
  readRecords,
  readNow,
  submitMutation,
  showNotice,
  openEditor,
  enrolChild,
  openProfile,
  renderVisitsCount = () => {},
}) {
  const state = {
    month: isoDateOf(readNow()).slice(0, 7),
    /** @type {string | null} */
    selectedDate: null,
    search: '',
    status: '',
    allMonths: false,
    showArchived: false,
    /** @type {ListSortState} */
    sort: { field: 'date', direction: 'asc', manual: false },
  };

  statusFilter.innerHTML =
    '<option value="">Toate</option>' +
    VISIT_STATUSES.map(status => `<option value="${escapeHtml(status)}">${escapeHtml(status)}</option>`).join('');

  const listView = createVisitsListView({ elements: { head, table } });
  const calendarView = createVisitsCalendarView({ elements: { calendar } });

  function render() {
    const records = readRecords();
    const now = readNow();
    const todayStr = isoDateOf(now);

    monthLabel.textContent = formatMonthName(state.month);

    // domain/visit-statistics.mjs și domain/visit-status.mjs au propriul tip
    // local, minimal, `Visit` (independent de contractul canonic din
    // #shared/contracts); cast la limita dintre cele două.
    const funnelStats = summarizeVisitFunnel(/** @type {any} */ (records.visits), todayStr);
    funnel.innerHTML =
      `<article class="card yellow"><p>Programate</p><strong>${funnelStats.scheduled}</strong><small>de azi înainte</small></article>` +
      `<article class="card mint"><p>Efectuate</p><strong>${funnelStats.done}</strong><small>ultimele 12 luni</small></article>` +
      `<article class="card orange"><p>Înscriși</p><strong>${funnelStats.enrolled}</strong><small>ultimele 12 luni</small></article>` +
      `<article class="card pink"><p>Renunțat</p><strong>${funnelStats.withdrew}</strong><small>ultimele 12 luni</small></article>`;

    // Calendarul arată întotdeauna vizitele nearhivate ale lunii răsfoite,
    // indiferent de filtrele listei de mai jos (căutare, statut, arhivare).
    const visitsByDate = new Map();
    for (const visit of records.visits) {
      if (visit.archived) continue;
      const list = visitsByDate.get(visit.date) || [];
      list.push(visit);
      visitsByDate.set(visit.date, list);
    }
    for (const list of visitsByDate.values()) list.sort((a, b) => a.time.localeCompare(b.time));
    calendarView.render({
      weeks: buildMonthGrid(state.month, todayStr),
      visitsByDate,
      selectedDate: state.selectedDate,
      onSelectDate: selectDate,
    });

    const normalizedSearch = normalizeSearchText(state.search);
    const rows = (
      state.allMonths ? records.visits : records.visits.filter(visit => visit.date.slice(0, 7) === state.month)
    ).filter(
      visit =>
        (state.showArchived ? visit.archived : !visit.archived) &&
        (!state.status || visit.status === state.status) &&
        (!state.selectedDate || visit.date === state.selectedDate) &&
        matchesRecordListSearch('visits', visit, records, normalizedSearch),
    );
    sortListRows(rows, state.sort, (field, row) => readVisitSortValue(field, row, records));
    listView.render({ visits: rows, records, sortState: state.sort, onSort, onQuickAction });
    summaryText.innerHTML = `<strong>${rows.length}</strong> ${rows.length === 1 ? 'vizită' : 'vizite'}`;

    const upcoming = countVisitsForDays(/** @type {any} */ (records.visits), todayStr);
    renderVisitsCount(funnelStats.scheduled);
  }

  /** @param {string} date */
  function selectDate(date) {
    state.selectedDate = state.selectedDate === date ? null : date;
    render();
  }

  /** @param {string} monthKey */
  function setMonth(monthKey) {
    state.month = monthKey;
    state.selectedDate = null;
    render();
  }

  /**
   * @param {string} field
   * @param {'asc' | 'desc'} direction
   */
  function onSort(field, direction) {
    state.sort = applyManualSort(state.sort, ALLOWED_SORT_FIELDS, field, direction);
    render();
  }

  /**
   * @param {string} visitId
   * @param {string} newStatus
   */
  async function applyQuickStatus(visitId, newStatus) {
    const visit = readRecords().visits.find(item => item.id === visitId);
    if (!visit) return;
    try {
      await submitMutation('/api/record', {
        type: 'visits',
        mode: 'update',
        // Statutul vine dintr-un `data-*` din DOM (string neîncorsetat); allowedNextStatuses()
        // din markup limitează opțiunile reale, applyVisitStatus() verifică tranziția oricum.
        record: /** @type {any} */ (applyVisitStatus(/** @type {any} */ (visit), newStatus, readNow().toISOString())),
      });
    } catch (error) {
      showNotice(/** @type {Error} */ (error).message, true);
    }
  }

  /** @param {Visit} visit */
  function openEnrolFlow(visit) {
    openEditor('children', undefined, {
      prefill: buildChildPrefill(visit),
      title: `Înscrie copilul: ${visit.name}`,
      submit: async child => {
        const result = /** @type {{ childId: string }} */ (await enrolChild(visit.id, child));
        showNotice('Copil înscris. Vizita a fost marcată „Înscris”.');
        openProfile(result.childId);
        return result;
      },
    });
  }

  /**
   * @param {string} visitId
   * @param {string} action statutul ales, sau „enrol”
   */
  function onQuickAction(visitId, action) {
    const visit = readRecords().visits.find(item => item.id === visitId);
    if (!visit) return;
    if (action === 'enrol') {
      openEnrolFlow(visit);
      return;
    }
    void applyQuickStatus(visitId, action);
  }

  search.oninput = () => {
    state.search = search.value;
    render();
  };
  statusFilter.onchange = () => {
    state.status = statusFilter.value;
    render();
  };
  allMonthsCheckbox.onchange = () => {
    state.allMonths = allMonthsCheckbox.checked;
    render();
  };
  archiveCheckbox.onchange = () => {
    state.showArchived = archiveCheckbox.checked;
    render();
  };
  prevMonthButton.onclick = () => setMonth(shiftMonthKey(state.month, -1));
  nextMonthButton.onclick = () => setMonth(shiftMonthKey(state.month, 1));
  todayButton.onclick = () => setMonth(isoDateOf(readNow()).slice(0, 7));

  return { render };
}
