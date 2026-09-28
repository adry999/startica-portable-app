import { cents } from '#shared/domain/money.mjs';

/** @typedef {import('../personal.types.d.mts').Salary} Salary */

const round2 = value => cents(value) / 100;

/**
 * Ultimul `validFrom <= month` (precedentul `feeEntryFor` din tuition-obligation.mjs).
 * @param {Salary[]} salaries
 * @param {string} staffId
 * @param {string} month
 * @returns {Salary | null}
 */
export function salaryEntryFor(salaries, staffId, month) {
  const entries = salaries
    .filter(salary => salary.staffId === staffId && salary.validFrom <= month)
    .sort((left, right) => left.validFrom.localeCompare(right.validFrom));
  return entries.at(-1) ?? null;
}

/**
 * Formula depinde de `salary.mode` (decizia 6–7 din plan): `fix` scade doar zilele
 * absente (nemotivate, sau nemotivate+învoire+FP după setare); `zi` e tarif × zile
 * lucrate din toată luna; `bazin` ignoră `amount` — vine din Bazin (`coachPay`, port
 * injectat, `null` cât timp Bazin nu e construit sau luna nu e încă închisă).
 * @param {{
 *   salary: Pick<Salary, 'mode' | 'amount'>,
 *   timesheetRow: { a: number, i: number, fp: number, worked: number, workingDays: number, workingDaysInMonth: number },
 *   settings: { deductOnlyUnexcused: boolean },
 *   coachPay: { amount: number, rate: number, sessionsHeld: number, childrenPresent: number, mode: 'per_child' | 'per_session' } | null,
 * }} input
 * @returns {{ gross: number | null, base: string, deductible: number }}
 */
export function salaryForMonth({ salary, timesheetRow, settings, coachPay }) {
  const { mode, amount } = salary;
  if (mode === 'fix') {
    const deductible = settings.deductOnlyUnexcused
      ? timesheetRow.a
      : timesheetRow.a + timesheetRow.i + timesheetRow.fp;
    // M3 (decizie): pro-rata pe zilele lucrătoare ale întregii luni calendaristice, nu doar
    // cele din intervalul activ — un angajat intrat sau ieșit în cursul lunii primește
    // proporția din lună, nu salariul întreg pentru câteva zile lucrate.
    const workingDaysInMonth = timesheetRow.workingDaysInMonth ?? timesheetRow.workingDays;
    const gross =
      workingDaysInMonth > 0 ? round2((amount * (timesheetRow.workingDays - deductible)) / workingDaysInMonth) : 0;
    let base = `${amount} lei / lună`;
    if (timesheetRow.workingDays < workingDaysInMonth)
      base += ` · ${timesheetRow.workingDays} din ${workingDaysInMonth} zile lucrătoare`;
    if (deductible > 0) base += ` · ${deductible} zile absent`;
    return { gross, base, deductible };
  }
  if (mode === 'zi') {
    return {
      gross: round2(amount * timesheetRow.worked),
      base: `${amount} lei × ${timesheetRow.worked} zile`,
      deductible: 0,
    };
  }
  // bazin
  if (!coachPay) return { gross: null, base: 'de închis în Bazin', deductible: 0 };
  const unit = coachPay.mode === 'per_child' ? 'copii' : 'ședințe';
  const count = coachPay.mode === 'per_child' ? coachPay.childrenPresent : coachPay.sessionsHeld;
  return { gross: coachPay.amount, base: `${coachPay.rate} lei × ${count} ${unit}`, deductible: 0 };
}
