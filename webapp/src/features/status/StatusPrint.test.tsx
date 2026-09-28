import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { formatMoney } from '#shared/format/money-format.mjs';
import { StatusPrint } from './StatusPrint';
import type { StatusRowView } from './useStatus';

const rows: StatusRowView[] = [
  {
    id: 'c1',
    name: 'Avram Maria',
    archived: false,
    groupId: null,
    groupName: '',
    parent: 'Avram Valentin',
    phone: '069000000',
    currency: 'MDL',
    expected: 1000,
    paid: 1000,
    rest: 0,
    due: '2026-09-06',
    label: 'Plătit',
  },
  {
    id: 'c2',
    name: 'Popa Ana',
    archived: false,
    groupId: null,
    groupName: '',
    parent: 'Popa Ion',
    phone: '',
    currency: 'MDL',
    expected: 1200,
    paid: 0,
    rest: 1200,
    due: '2026-09-05',
    label: 'Restanță',
  },
];

function renderPrint(overrides: Partial<Parameters<typeof StatusPrint>[0]> = {}) {
  return render(
    <StatusPrint
      month="2026-09"
      asOf="2026-09-25"
      filterLabel="toate grupele"
      rows={rows}
      showPhone={true}
      orientation="landscape"
      kindergarten={null}
      {...overrides}
    />,
  );
}

describe('StatusPrint', () => {
  it('arată antetul, totalurile și rândurile, cu restanța evidențiată', () => {
    renderPrint({ kindergarten: { displayName: 'Grădinița Startica', idno: '1000600000000' } as never });

    expect(screen.getByText('Grădinița Startica')).toBeInTheDocument();
    expect(screen.getByText(/Situația plăților · 2026 Sep/)).toBeInTheDocument();
    expect(screen.getByText(/filtru: toate grupele/)).toBeInTheDocument();

    const table = screen.getByRole('table');
    expect(within(table).getByText('Avram Maria')).toBeInTheDocument();
    expect(within(table).getByText('Restanță')).toBeInTheDocument();
    expect(within(table).getByText('069000000')).toBeInTheDocument();
    const restanțaRow = within(table).getByText('Popa Ana').closest('tr')!;
    expect(restanțaRow.className).toMatch(/printRowUnpaid/);

    expect(screen.getByText(`Total · ${rows.length} copii`)).toBeInTheDocument();
    expect(screen.getAllByText(formatMoney(2200)).length).toBeGreaterThanOrEqual(1);
  });

  it('fără date de grădiniță, antetul cade pe „Startica” generic', () => {
    renderPrint();
    expect(screen.getByText('Startica')).toBeInTheDocument();
  });

  it('coloana Telefon apare doar când showPhone e adevărat', () => {
    renderPrint({ showPhone: false });
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.queryByText('Telefon')).not.toBeInTheDocument();
  });
});
