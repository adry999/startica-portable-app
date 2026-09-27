import { loadXlsx } from '@shared/xlsx-loader';
import { formatDate, formatMonthLabel } from '#shared/format/date-format.mjs';
import type { AccountingReport } from './useAccountingReport';

export interface ReportExportOptions {
  includePayerNames: boolean;
  includeEurDetails: boolean;
}

const METHOD_LABEL: Record<string, string> = { cash: 'Cash', card: 'Card', transfer: 'Transfer' };

/** `startica-raport-AAAA-LL.xlsx`, cu luna de start a perioadei (lună/trimestru/an/interval). */
export function reportExportFilename(period: { from: string }): string {
  return `startica-raport-${period.from.slice(0, 7)}.xlsx`;
}

/** `startica-raport-AAAA-LL-ambele.xlsx` — exportul „Ambele” (20-raport-contabil.md). */
export function reportExportFilenameAmbele(period: { from: string }): string {
  return `startica-raport-${period.from.slice(0, 7)}-ambele.xlsx`;
}

function summarySheetRows(report: AccountingReport) {
  const rows: (string | number)[][] = [
    ['Raport pentru contabil'],
    ['Perioada', report.period.label],
    [],
    ['Încasări', report.income, `${report.incomeCount} achitări`],
    ['Cheltuieli', report.expense, `${report.expenseCount} operațiuni`],
    ['Sold', report.balance],
    [],
    ['Încasări pe metode'],
    ...report.byMethod.map(entry => [entry.method, entry.amount, `${entry.count} mișcări`]),
    [],
    ['Cheltuieli pe categorii'],
    ...report.byCategory.map(entry => [entry.category, entry.amount, `${entry.count} operațiuni`]),
  ];
  if (report.eurRows.length) {
    rows.push([], ['Pentru taxe în EUR'], ['Total lei', report.eurTotalLei], ['Total EUR', report.eurTotalEur]);
  }
  if (report.unassignedCount) {
    rows.push([], [`${report.unassignedCount} achitări neasociate în perioadă`]);
  }
  return rows;
}

function paymentSheetRows(report: AccountingReport, options: ReportExportOptions) {
  return report.paymentRows.map(row => {
    const record: Record<string, string | number> = {
      Data: formatDate(row.date),
      Copil: row.childLabel,
    };
    if (options.includePayerNames) record['Plătitor'] = row.payerLabel;
    record['Metodă'] = row.methods.join(', ');
    record['Lei'] = row.amount;
    if (options.includeEurDetails) {
      record['Curs'] = row.fxRate ?? '';
      record['EUR'] = row.amountEur ?? '';
    }
    record['Luni acoperite'] = row.months.map(formatMonthLabel).join(', ');
    return record;
  });
}

function expenseSheetRows(report: AccountingReport) {
  return report.expenseRows.map(row => ({
    Data: formatDate(row.date),
    Categorie: row.category,
    Descriere: row.description,
    Metodă: row.method ? METHOD_LABEL[row.method] : '',
    Lei: row.amount,
  }));
}

/** Excel-ul pentru contabil: foile Rezumat, Încasări, Cheltuieli — vezi `20-raport-contabil.md`. */
export async function buildAccountingReportWorkbook(report: AccountingReport, options: ReportExportOptions) {
  const XLSX = await loadXlsx();
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(summarySheetRows(report)), 'Rezumat');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(paymentSheetRows(report, options)), 'Încasări');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(expenseSheetRows(report)), 'Cheltuieli');
  return { XLSX, workbook };
}

export async function downloadAccountingReportExcel(report: AccountingReport, options: ReportExportOptions) {
  const { XLSX, workbook } = await buildAccountingReportWorkbook(report, options);
  XLSX.writeFile(workbook, reportExportFilename(report.period), { compression: true });
}

export interface MultiBranchReportEntry {
  branchName: string;
  report: AccountingReport;
}

// Limita Excel pentru numele unei foi (și caracterele interzise) — un nume de filială
// lung, cu „ Încasări”/„ Cheltuieli” adăugat, poate depăși limita. Sufixul se păstrează
// întreg (se taie numele filialei), altfel cele două foi ale unei filiale ar coincide.
const SHEET_NAME_MAX_LENGTH = 31;
function sheetName(branchName: string, suffix: string): string {
  const safeName = branchName.replace(/[:\\/?*[\]]/g, ' ');
  const maxNameLength = Math.max(0, SHEET_NAME_MAX_LENGTH - suffix.length);
  return `${safeName.slice(0, maxNameLength)}${suffix}`;
}

function multiSummarySheetRows(entries: MultiBranchReportEntry[]) {
  const rows: (string | number)[][] = [
    ['Raport pentru contabil — Ambele filiale'],
    ['Perioada', entries[0]?.report.period.label ?? ''],
    [],
  ];
  let totalIncome = 0;
  let totalExpense = 0;
  for (const entry of entries) {
    rows.push(
      [entry.branchName],
      ['Încasări', entry.report.income, `${entry.report.incomeCount} achitări`],
      ['Cheltuieli', entry.report.expense, `${entry.report.expenseCount} operațiuni`],
      ['Sold', entry.report.balance],
      [],
    );
    totalIncome += entry.report.income;
    totalExpense += entry.report.expense;
  }
  rows.push(['Total'], ['Încasări', totalIncome], ['Cheltuieli', totalExpense], ['Sold', totalIncome - totalExpense]);
  return rows;
}

/**
 * Excel-ul exportului „Ambele” (20-raport-contabil.md, 19b): un Rezumat comun cu totalul
 * ambelor filiale, apoi câte o pereche de foi Încasări/Cheltuieli pentru fiecare filială.
 */
export async function buildMultiBranchWorkbook(entries: MultiBranchReportEntry[], options: ReportExportOptions) {
  const XLSX = await loadXlsx();
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(multiSummarySheetRows(entries)), 'Rezumat');
  for (const entry of entries) {
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(paymentSheetRows(entry.report, options)),
      sheetName(entry.branchName, ' Încasări'),
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(expenseSheetRows(entry.report)),
      sheetName(entry.branchName, ' Cheltuieli'),
    );
  }
  return { XLSX, workbook };
}

export async function downloadMultiBranchReportExcel(
  entries: MultiBranchReportEntry[],
  options: ReportExportOptions,
  period: { from: string },
) {
  const { XLSX, workbook } = await buildMultiBranchWorkbook(entries, options);
  XLSX.writeFile(workbook, reportExportFilenameAmbele(period), { compression: true });
}
