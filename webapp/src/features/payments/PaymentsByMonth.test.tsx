import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { ToastProvider } from '@shared/ui';
import { PaymentsByMonth } from './PaymentsByMonth';
import type { PaymentRowView, PaymentsData } from './usePayments';

function makeRow(id: string, date: string): PaymentRowView {
  return {
    id,
    date,
    dateLabel: date,
    childId: 'c1',
    childLabel: `Copil ${id}`,
    sourceName: '',
    unassigned: false,
    tenders: [{ method: 'Cash', amount: 100 }],
    allocations: [],
    total: 100,
    archived: false,
    serviceId: 'gradinita',
    serviceLabel: 'Grădiniță',
    serviceTone: 'blue',
  };
}

function makeData(rows: PaymentRowView[], overrides: Partial<PaymentsData> = {}): PaymentsData {
  return {
    status: 'ready',
    failureMessage: '',
    records: {} as PaymentsData['records'],
    rows,
    summary: {
      count: rows.length,
      total: 0,
      cash: 0,
      card: 0,
      transfer: 0,
      cashCount: 0,
      cardCount: 0,
      transferCount: 0,
    },
    groups: [],
    search: '',
    setSearch: () => {},
    childId: '',
    setChildId: () => {},
    method: '',
    setMethod: () => {},
    service: '',
    setService: () => {},
    services: [],
    groupFilter: 'all',
    setGroupFilter: () => {},
    periodPreset: 'tot',
    setPeriodPreset: () => {},
    periodFrom: '',
    setPeriodFrom: () => {},
    periodTo: '',
    setPeriodTo: () => {},
    archiveFilter: 'active',
    setArchiveFilter: () => {},
    resetUrlFilters: () => {},
    sort: { key: 'date', direction: 'desc' },
    setSort: () => {},
    archivePayment: async () => {},
    unarchivePayment: async () => {},
    archiveMany: async () => {},
    unarchiveMany: async () => {},
    createPayment: async () => ({ saved: true, auditIds: [] }),
    updatePayment: async () => {},
    deletePayment: async () => {},
    deleteManyForever: async () => {},
    ...overrides,
  };
}

function renderByMonth(data: PaymentsData) {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <PaymentsByMonth data={data} onEdit={() => {}} />
      </ToastProvider>
    </MemoryRouter>,
  );
}

afterEach(() => {
  localStorage.removeItem('table.pageSize');
});

describe('PaymentsByMonth', () => {
  it('arată paginare și limitează la 10 rânduri implicit pentru un set mare', () => {
    const rows = Array.from({ length: 25 }, (_, index) => makeRow(`p${index}`, `2026-0${(index % 9) + 1}-10`));
    renderByMonth(makeData(rows));

    const list = within(screen.getByTestId('payments-by-month-list'));
    expect(list.getAllByText(/Copil p/).length).toBe(10);
    expect(screen.getByText('1–10 din 25')).toBeInTheDocument();
  });

  it('nu arată bara de paginare când setul încape pe o singură pagină', () => {
    const rows = [makeRow('p1', '2026-09-01'), makeRow('p2', '2026-09-02')];
    renderByMonth(makeData(rows));

    expect(screen.queryByLabelText('Rânduri pe pagină')).not.toBeInTheDocument();
  });

  it('schimbă pagina la click pe "Pagina următoare" și persistă "Pe pagină" global', async () => {
    const user = userEvent.setup();
    const rows = Array.from({ length: 12 }, (_, index) => makeRow(`p${index}`, '2026-09-01'));
    renderByMonth(makeData(rows));

    await user.click(screen.getByRole('button', { name: 'Pagina următoare' }));
    expect(screen.getByText('11–12 din 12')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Rânduri pe pagină'), '25');
    expect(localStorage.getItem('table.pageSize')).toBe('25');
  });
});
