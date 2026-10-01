// Anul școlar începe în septembrie (Backup și setări → Grădinița, „An școlar: începe în septembrie").
// Sursă unică (PROMPT-CLAUDE-CODE-7.md §2) — Situația plăților și PeriodFilter (preset „an-scolar”)
// folosesc aceeași logică, nu doar module diferite cu formule identice.
export const SCHOOL_YEAR_START_MONTH = 9;

/** @param {string} monthKey YYYY-MM */
export function schoolYearStartOf(monthKey) {
  const [year, month] = monthKey.split('-').map(Number);
  return month >= SCHOOL_YEAR_START_MONTH ? year : year - 1;
}

/** @param {number} startYear */
export function schoolYearMonths(startYear) {
  return Array.from({ length: 12 }, (_, index) => {
    const offset = SCHOOL_YEAR_START_MONTH - 1 + index;
    return `${startYear + Math.floor(offset / 12)}-${String((offset % 12) + 1).padStart(2, '0')}`;
  });
}

/** @param {number} startYear */
export const schoolYearLabel = startYear => `Anul școlar ${startYear}–${startYear + 1}`;

/**
 * Interval pe zile al anului școlar (1 septembrie – 31 august) — pentru presetarea
 * „an-scolar” a `PeriodFilter`, care are nevoie de `from`/`to` exacte, nu doar de luni.
 * @param {number} startYear
 * @returns {{ from: string, to: string }}
 */
export function schoolYearDayBounds(startYear) {
  return { from: `${startYear}-09-01`, to: `${startYear + 1}-08-31` };
}
