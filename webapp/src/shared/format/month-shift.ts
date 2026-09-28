/** Luna „YYYY-MM” deplasată cu `delta` luni (poate fi negativ) — pentru MonthStepper/DayStepper. */
export function shiftMonth(monthKey: string, delta: number): string {
  const [year, month] = monthKey.split('-').map(Number);
  const date = new Date(year, month - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}
