import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@shared/ui';
import { ReportExportDrawer } from './ReportExportDrawer';
import type { AccountingReport, AccountingReportData } from './useAccountingReport';

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

function fakeReport(): AccountingReport {
  return {
    period: { from: '2026-08-01', to: '2026-08-31', label: 'August 2026' },
    income: 1000,
    incomeCount: 1,
    expense: 200,
    expenseCount: 1,
    balance: 800,
    unassignedCount: 0,
    byMethod: [],
    byCategory: [],
    eurRows: [],
    eurTotalLei: 0,
    eurTotalEur: 0,
    days: [],
    paymentRows: [],
    expenseRows: [],
  };
}

function fakeData(): AccountingReportData {
  const report = fakeReport();
  return {
    status: 'ready',
    failureMessage: '',
    records: { children: [], payments: [], expenses: [], groups: [], categories: [], visits: [] } as never,
    period: report.period,
    report,
    buildForPeriod: () => report,
  };
}

function renderDrawer() {
  return render(
    <ToastProvider>
      <ReportExportDrawer open anchorMonth="2026-08" data={fakeData()} onClose={vi.fn()} onOpenAssign={vi.fn()} />
    </ToastProvider>,
  );
}

const buiucani = {
  id: 'BR-1',
  name: 'Filiala Buiucani',
  color: 'orange',
  address: '',
  createdAt: '2026-01-01T00:00:00.000Z',
  folder: null,
  children: 10,
  groups: 2,
  lastLocal: '2026-09-27T10:00:00.000Z',
};
const botanica = { ...buiucani, id: 'BR-2', name: 'Filiala Botanica', color: 'mint', folder: 'botanica' };

describe('ReportExportDrawer', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('cu o singură filială, selectorul de filială nu apare', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/branches') return jsonResponse({ activeBranchId: 'BR-1', branches: [buiucani] });
        throw new Error(`neașteptat: ${path}`);
      }),
    );

    renderDrawer();
    await screen.findByText('Exportă pentru contabil');

    expect(screen.queryByText('Filiala')).not.toBeInTheDocument();
  });

  it('selectorul de filială apare doar cu mai multe filiale și e dezactivat pe PDF', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/branches') return jsonResponse({ activeBranchId: 'BR-1', branches: [buiucani, botanica] });
        throw new Error(`neașteptat: ${path}`);
      }),
    );

    renderDrawer();
    const user = userEvent.setup();

    await screen.findByText('Filiala Buiucani');
    const currentOption = screen.getByRole('radio', { name: 'Filiala Buiucani' });
    const bothOption = screen.getByRole('radio', { name: 'Ambele (o foaie pe filială)' });
    expect(currentOption).toBeChecked();
    expect(currentOption).not.toBeDisabled();
    expect(bothOption).not.toBeDisabled();

    await user.click(screen.getByRole('radio', { name: /^PDF/ }));

    expect(currentOption).toBeDisabled();
    expect(bothOption).toBeDisabled();
    expect(screen.getByText('PDF-ul tipărește filiala deschisă.')).toBeInTheDocument();
  });
});
