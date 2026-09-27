import { render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatMoney } from '#shared/format/money-format.mjs';
import { StatusPrint } from './StatusPrint';
import type { StatusRowView } from './useStatus';

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

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
      {...overrides}
    />,
  );
}

describe('StatusPrint', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('arată antetul, totalurile și rândurile, cu restanța evidențiată', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/kindergarten')
          return jsonResponse({ displayName: 'Grădinița Startica', idno: '1000600000000' });
        throw new Error(`neașteptat: ${path}`);
      }),
    );

    renderPrint();

    expect(await screen.findByText('Grădinița Startica')).toBeInTheDocument();
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

  it('coloana Telefon apare doar când showPhone e adevărat', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({})),
    );

    renderPrint({ showPhone: false });
    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(screen.queryByText('Telefon')).not.toBeInTheDocument();
  });
});
