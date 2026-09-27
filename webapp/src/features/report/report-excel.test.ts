import { describe, expect, it, vi } from 'vitest';
import * as XLSX from 'xlsx';
import {
  buildAccountingReportWorkbook,
  buildMultiBranchWorkbook,
  downloadAccountingReportExcel,
  downloadMultiBranchReportExcel,
  reportExportFilename,
  reportExportFilenameAmbele,
} from './report-excel';
import type { AccountingReport } from './useAccountingReport';

const { writeFileMock } = vi.hoisted(() => ({ writeFileMock: vi.fn() }));
vi.mock('xlsx', async importOriginal => {
  const actual = await importOriginal<typeof import('xlsx')>();
  return { ...actual, writeFile: writeFileMock };
});

function fakeReport(): AccountingReport {
  return {
    period: { from: '2026-08-01', to: '2026-08-31', label: 'August 2026' },
    income: 1500,
    incomeCount: 2,
    expense: 400,
    expenseCount: 1,
    balance: 1100,
    unassignedCount: 1,
    byMethod: [
      { method: 'Cash', amount: 1000, count: 1, percent: 66.67 },
      { method: 'Card', amount: 500, count: 1, percent: 33.33 },
    ],
    byCategory: [{ category: 'Salarii', amount: 400, count: 1, percent: 100 }],
    eurRows: [
      {
        id: 'PAY-2',
        date: '2026-08-10',
        childLabel: 'Ana Ionescu',
        amount: 1000,
        fxRate: 19.74,
        fxRateSource: 'bnm',
        amountEur: 50.66,
      },
    ],
    eurTotalLei: 1000,
    eurTotalEur: 50.66,
    days: [],
    paymentRows: [
      {
        id: 'PAY-1',
        date: '2026-08-05',
        childId: '',
        childLabel: 'Copil neasociat',
        payerLabel: 'Ion Popescu',
        unassigned: true,
        methods: ['Cash'],
        amount: 500,
        fxRate: null,
        fxRateSource: null,
        amountEur: null,
        months: ['2026-08'],
        archived: false,
      },
      {
        id: 'PAY-2',
        date: '2026-08-10',
        childId: 'C-1',
        childLabel: 'Ana Ionescu',
        payerLabel: 'Ana Ionescu',
        unassigned: false,
        methods: ['Card'],
        amount: 1000,
        fxRate: 19.74,
        fxRateSource: 'bnm',
        amountEur: 50.66,
        months: ['2026-08'],
        archived: false,
      },
    ],
    expenseRows: [
      {
        id: 'EXP-1',
        date: '2026-08-06',
        category: 'Salarii',
        categoryBucket: 'Salarii',
        description: 'Salariu august',
        method: 'transfer',
        amount: 400,
        archived: false,
      },
    ],
  };
}

describe('report-excel', () => {
  it('foaia Încasări are suma coloanei Lei egală cu totalul de pe ecran (report.income)', async () => {
    const report = fakeReport();
    const { workbook } = await buildAccountingReportWorkbook(report, {
      includePayerNames: true,
      includeEurDetails: true,
    });

    const rows = XLSX.utils.sheet_to_json<Record<string, number>>(workbook.Sheets['Încasări']);
    const sum = rows.reduce((total, row) => total + Number(row.Lei), 0);

    expect(sum).toBe(report.income);
    expect(rows).toHaveLength(report.paymentRows.length);
  });

  it('foaia Cheltuieli are suma coloanei Lei egală cu totalul de pe ecran (report.expense)', async () => {
    const report = fakeReport();
    const { workbook } = await buildAccountingReportWorkbook(report, {
      includePayerNames: true,
      includeEurDetails: true,
    });

    const rows = XLSX.utils.sheet_to_json<Record<string, number>>(workbook.Sheets['Cheltuieli']);
    const sum = rows.reduce((total, row) => total + Number(row.Lei), 0);

    expect(sum).toBe(report.expense);
  });

  it('cu includePayerNames oprit, coloana Plătitor nu apare în foaia Încasări', async () => {
    const report = fakeReport();
    const { workbook } = await buildAccountingReportWorkbook(report, {
      includePayerNames: false,
      includeEurDetails: true,
    });

    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets['Încasări']);
    expect(rows[0]).not.toHaveProperty('Plătitor');
  });

  it('cu includeEurDetails oprit, coloanele Curs și EUR nu apar în foaia Încasări', async () => {
    const report = fakeReport();
    const { workbook } = await buildAccountingReportWorkbook(report, {
      includePayerNames: true,
      includeEurDetails: false,
    });

    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets['Încasări']);
    expect(rows[1]).not.toHaveProperty('Curs');
    expect(rows[1]).not.toHaveProperty('EUR');
  });

  it('downloadAccountingReportExcel scrie fișierul cu numele startica-raport-AAAA-LL.xlsx', async () => {
    const report = fakeReport();
    await downloadAccountingReportExcel(report, { includePayerNames: true, includeEurDetails: true });

    expect(reportExportFilename(report.period)).toBe('startica-raport-2026-08.xlsx');
    expect(writeFileMock).toHaveBeenCalledWith(expect.anything(), 'startica-raport-2026-08.xlsx', {
      compression: true,
    });
  });

  it('exportul „Ambele” are o foaie Încasări și una Cheltuieli per filială și un Rezumat comun cu total', async () => {
    const buiucani = fakeReport();
    const botanica = fakeReport();
    const entries = [
      { branchName: 'Filiala Buiucani', report: buiucani },
      { branchName: 'Filiala Botanica', report: botanica },
    ];
    const { workbook } = await buildMultiBranchWorkbook(entries, { includePayerNames: true, includeEurDetails: true });

    expect(workbook.SheetNames).toEqual([
      'Rezumat',
      'Filiala Buiucani Încasări',
      'Filiala Buiucani Cheltuieli',
      'Filiala Botanica Încasări',
      'Filiala Botanica Cheltuieli',
    ]);

    const buiucaniIncome = XLSX.utils.sheet_to_json<Record<string, number>>(
      workbook.Sheets['Filiala Buiucani Încasări'],
    );
    expect(buiucaniIncome.reduce((sum, row) => sum + Number(row.Lei), 0)).toBe(buiucani.income);
    const botanicaExpense = XLSX.utils.sheet_to_json<Record<string, number>>(
      workbook.Sheets['Filiala Botanica Cheltuieli'],
    );
    expect(botanicaExpense.reduce((sum, row) => sum + Number(row.Lei), 0)).toBe(botanica.expense);

    const summaryRows = XLSX.utils.sheet_to_json<(string | number)[]>(workbook.Sheets['Rezumat'], { header: 1 });
    const totalRowIndex = summaryRows.findIndex(row => row[0] === 'Total');
    const totalIncomeRow = summaryRows[totalRowIndex + 1];
    const totalExpenseRow = summaryRows[totalRowIndex + 2];
    expect(totalIncomeRow[1]).toBe(buiucani.income + botanica.income);
    expect(totalExpenseRow[1]).toBe(buiucani.expense + botanica.expense);
  });

  it('numele foilor sunt tăiate la 31 de caractere, limita Excel', async () => {
    const entries = [{ branchName: 'Filiala cu un nume foarte foarte lung', report: fakeReport() }];
    const { workbook } = await buildMultiBranchWorkbook(entries, { includePayerNames: true, includeEurDetails: true });

    for (const name of workbook.SheetNames) expect(name.length).toBeLessThanOrEqual(31);
  });

  it('downloadMultiBranchReportExcel scrie fișierul cu numele startica-raport-AAAA-LL-ambele.xlsx', async () => {
    const entries = [{ branchName: 'Filiala Buiucani', report: fakeReport() }];
    const period = { from: '2026-08-01' };
    await downloadMultiBranchReportExcel(entries, { includePayerNames: true, includeEurDetails: true }, period);

    expect(reportExportFilenameAmbele(period)).toBe('startica-raport-2026-08-ambele.xlsx');
    expect(writeFileMock).toHaveBeenCalledWith(expect.anything(), 'startica-raport-2026-08-ambele.xlsx', {
      compression: true,
    });
  });
});
