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
