import { loadXlsx } from '@shared/xlsx-loader';
import type { DayCellKind } from '#features/attendance/attendance.types.d.mts';

export interface AttendanceExportRow {
  name: string;
  cells: { date: string; kind: DayCellKind }[];
  presentDays: number;
  workingDays: number;
}

const MARK_BY_KIND: Partial<Record<DayCellKind, string>> = { present: 'P', absent: 'A', excused: 'M' };

/** Foaia .xlsx a lunii (18b): antet cu numărul zilei, un rând per copil cu P/A/M și totalul. */
export function buildAttendanceSheet(rows: AttendanceExportRow[], dates: string[]): (string | number)[][] {
  const header: (string | number)[] = ['Copil', ...dates.map(date => Number(date.slice(8, 10))), 'Zile'];
  const body = rows.map(row => [
    row.name,
    ...row.cells.map(cell => MARK_BY_KIND[cell.kind] ?? ''),
    `${row.presentDays}/${row.workingDays}`,
  ]);
  return [header, ...body];
}

export async function exportAttendanceMonth(
  rows: AttendanceExportRow[],
  dates: string[],
  groupName: string,
  month: string,
): Promise<void> {
  const XLSX = await loadXlsx();
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(buildAttendanceSheet(rows, dates)), 'Prezența');
  XLSX.writeFile(workbook, `Prezenta_${groupName}_${month}.xlsx`);
}
