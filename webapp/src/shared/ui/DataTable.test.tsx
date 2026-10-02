import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DataTable, type DataTableColumn } from './DataTable';

interface Child {
  id: string;
  name: string;
  fee: number;
}

interface Staff {
  id: string;
  name: string;
  departmentId: string;
}

const children: Child[] = [
  { id: 'c1', name: 'Andrei', fee: 1500 },
  { id: 'c2', name: 'Maria', fee: 2000 },
  { id: 'c3', name: 'Ioana', fee: 1000 },
];

const columns: DataTableColumn<Child>[] = [
  { key: 'name', header: 'Copil', render: c => c.name, sortValue: c => c.name },
  { key: 'fee', header: 'Taxă', render: c => `${c.fee} lei`, sortValue: c => c.fee, align: 'end' },
  { key: 'actions', header: '', render: () => '⋯' },
];

describe('DataTable', () => {
  it('randează rândurile în ordinea primită implicit', () => {
    render(<DataTable columns={columns} rows={children} rowKey={c => c.id} />);
    const rows = screen.getAllByRole('row').slice(1); // fără antet
    expect(within(rows[0]).getByText('Andrei')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Maria')).toBeInTheDocument();
    expect(within(rows[2]).getByText('Ioana')).toBeInTheDocument();
  });

  it('sortează crescător, apoi descrescător la click repetat pe antet', async () => {
    render(<DataTable columns={columns} rows={children} rowKey={c => c.id} />);
    const header = screen.getByRole('button', { name: /Copil/ });

    await userEvent.click(header);
    let rows = screen.getAllByRole('row').slice(1);
    expect(within(rows[0]).getByText('Andrei')).toBeInTheDocument();
    expect(within(rows[2]).getByText('Maria')).toBeInTheDocument();

    await userEvent.click(header);
    rows = screen.getAllByRole('row').slice(1);
    expect(within(rows[0]).getByText('Maria')).toBeInTheDocument();
    expect(within(rows[2]).getByText('Andrei')).toBeInTheDocument();
  });

  it('F21 (PROMPT-11 §9): a treia oară pe altă coloană revine la implicit, nu mai alternează asc/desc', async () => {
    render(
      <DataTable
        columns={columns}
        rows={children}
        rowKey={c => c.id}
        defaultSort={{ key: 'name', direction: 'asc' }}
      />,
    );
    const header = screen.getByRole('button', { name: /Taxă/ });

    await userEvent.click(header); // asc
    await userEvent.click(header); // desc
    await userEvent.click(header); // a treia oară: revine la implicit (Copil asc), nu Taxă asc
    expect(screen.getByRole('columnheader', { name: /Taxă/ })).toHaveAttribute('aria-sort', 'none');
    expect(screen.getByRole('columnheader', { name: /Copil/ })).toHaveAttribute('aria-sort', 'ascending');
    const rows = screen.getAllByRole('row').slice(1);
    expect(within(rows[0]).getByText('Andrei')).toBeInTheDocument();
  });

  it('F21 (PROMPT-11 §9): sortValue null rămâne la coadă indiferent de direcție', async () => {
    const columnsWithGap: DataTableColumn<Child>[] = [
      { key: 'name', header: 'Copil', render: c => c.name, sortValue: c => c.name },
      { key: 'fee', header: 'Taxă', render: c => c.fee, sortValue: c => (c.fee === 2000 ? null : c.fee) },
    ];
    render(<DataTable columns={columnsWithGap} rows={children} rowKey={c => c.id} />);
    const header = screen.getByRole('button', { name: 'Taxă' });

    await userEvent.click(header); // asc
    let rows = screen.getAllByRole('row').slice(1);
    expect(within(rows[2]).getByText('Maria')).toBeInTheDocument();

    await userEvent.click(header); // desc — rândul fără valoare rămâne tot ultimul
    rows = screen.getAllByRole('row').slice(1);
    expect(within(rows[2]).getByText('Maria')).toBeInTheDocument();
  });

  it('nu sortează pe o coloană fără sortValue', async () => {
    render(<DataTable columns={columns} rows={children} rowKey={c => c.id} />);
    expect(screen.queryByRole('button', { name: /^$/ })).not.toBeInTheDocument();
  });

  it('folosește defaultSort la montare (13.1 — liste cu dată, cele mai noi primele)', () => {
    render(
      <DataTable
        columns={columns}
        rows={children}
        rowKey={c => c.id}
        defaultSort={{ key: 'fee', direction: 'desc' }}
      />,
    );
    const rows = screen.getAllByRole('row').slice(1);
    expect(within(rows[0]).getByText('Maria')).toBeInTheDocument(); // 2000
    expect(within(rows[2]).getByText('Ioana')).toBeInTheDocument(); // 1000
  });

  it('sortarea controlată (sort/onSortChange) nu ține stare proprie — apelantul decide', async () => {
    const onSortChange = vi.fn();
    const { rerender } = render(
      <DataTable
        columns={columns}
        rows={children}
        rowKey={c => c.id}
        sort={{ key: 'fee', direction: 'asc' }}
        onSortChange={onSortChange}
      />,
    );
    let rows = screen.getAllByRole('row').slice(1);
    expect(within(rows[0]).getByText('Ioana')).toBeInTheDocument(); // 1000, cea mai mică

    await userEvent.click(screen.getByRole('button', { name: /Taxă/ }));
    expect(onSortChange).toHaveBeenCalledWith({ key: 'fee', direction: 'desc' });

    // Fără apelantul să re-dea sort-ul schimbat, tabelul rămâne pe valoarea controlată primită.
    rerender(
      <DataTable
        columns={columns}
        rows={children}
        rowKey={c => c.id}
        sort={{ key: 'fee', direction: 'desc' }}
        onSortChange={onSortChange}
      />,
    );
    rows = screen.getAllByRole('row').slice(1);
    expect(within(rows[0]).getByText('Maria')).toBeInTheDocument(); // 2000, cea mai mare
  });

  it('pagina controlată restaurată la montare (ex. din URL) nu e resetată la 1', () => {
    const onPageChange = vi.fn();
    render(
      <DataTable
        columns={columns}
        rows={children}
        rowKey={c => c.id}
        pageSize={2}
        page={2}
        onPageChange={onPageChange}
      />,
    );
    expect(onPageChange).not.toHaveBeenCalled();
    expect(screen.getByText('Ioana')).toBeInTheDocument();
    expect(screen.queryByText('Andrei')).not.toBeInTheDocument();
  });

  it('pagina controlată (page/onPageChange) — apelantul ține numărul paginii', async () => {
    const onPageChange = vi.fn();
    render(
      <DataTable
        columns={columns}
        rows={children}
        rowKey={c => c.id}
        pageSize={2}
        page={1}
        onPageChange={onPageChange}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: '2' }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('paginează când sunt mai multe rânduri decât pageSize', async () => {
    render(<DataTable columns={columns} rows={children} rowKey={c => c.id} pageSize={2} />);
    expect(screen.getByText('1–2 din 3')).toBeInTheDocument();
    expect(screen.queryByText('Ioana')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '2' }));
    expect(screen.getByText('Ioana')).toBeInTheDocument();
    expect(screen.queryByText('Andrei')).not.toBeInTheDocument();
  });

  it('apelează onRowClick cu rândul corect, fără să declanșeze selecția', async () => {
    const onRowClick = vi.fn();
    const onSelectedRowKeysChange = vi.fn();
    render(
      <DataTable
        columns={columns}
        rows={children}
        rowKey={c => c.id}
        onRowClick={onRowClick}
        selectable
        selectedRowKeys={new Set()}
        onSelectedRowKeysChange={onSelectedRowKeysChange}
      />,
    );
    await userEvent.click(screen.getByText('Andrei'));
    expect(onRowClick).toHaveBeenCalledWith(children[0]);
    expect(onSelectedRowKeysChange).not.toHaveBeenCalled();
  });

  it('selectează/deselectează un rând individual', async () => {
    const onSelectedRowKeysChange = vi.fn();
    render(
      <DataTable
        columns={columns}
        rows={children}
        rowKey={c => c.id}
        selectable
        selectedRowKeys={new Set()}
        onSelectedRowKeysChange={onSelectedRowKeysChange}
      />,
    );
    const rows = screen.getAllByRole('row').slice(1);
    await userEvent.click(within(rows[0]).getByRole('checkbox'));
    expect(onSelectedRowKeysChange).toHaveBeenCalledWith(new Set(['c1']));
  });

  it('selectează toate rândurile din pagina curentă cu checkbox-ul din antet', async () => {
    const onSelectedRowKeysChange = vi.fn();
    render(
      <DataTable
        columns={columns}
        rows={children}
        rowKey={c => c.id}
        selectable
        selectedRowKeys={new Set()}
        onSelectedRowKeysChange={onSelectedRowKeysChange}
      />,
    );
    await userEvent.click(screen.getByRole('checkbox', { name: 'Selectează toate rândurile din pagină' }));
    expect(onSelectedRowKeysChange).toHaveBeenCalledWith(new Set(['c1', 'c2', 'c3']));
  });

  it('afișează starea goală când nu sunt rânduri', () => {
    render(<DataTable columns={columns} rows={[]} rowKey={c => c.id} emptyState={<p>Niciun copil găsit</p>} />);
    expect(screen.getByText('Niciun copil găsit')).toBeInTheDocument();
  });

  it('rândul e focusabil de la tastatură când există onRowClick', () => {
    const onRowClick = vi.fn();
    render(<DataTable columns={columns} rows={children} rowKey={c => c.id} onRowClick={onRowClick} />);
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows[0]).toHaveAttribute('tabIndex', '0');
  });

  it('apelează onRowClick la Enter pe rândul focusat', async () => {
    const onRowClick = vi.fn();
    render(<DataTable columns={columns} rows={children} rowKey={c => c.id} onRowClick={onRowClick} />);
    const rows = screen.getAllByRole('row').slice(1);
    rows[0].focus();
    await userEvent.keyboard('{Enter}');
    expect(onRowClick).toHaveBeenCalledWith(children[0]);
  });

  it('apelează onRowClick la Space pe rândul focusat', async () => {
    const onRowClick = vi.fn();
    render(<DataTable columns={columns} rows={children} rowKey={c => c.id} onRowClick={onRowClick} />);
    const rows = screen.getAllByRole('row').slice(1);
    rows[0].focus();
    await userEvent.keyboard(' ');
    expect(onRowClick).toHaveBeenCalledWith(children[0]);
  });

  it('rândul nu e focusabil de la tastatură fără onRowClick', () => {
    render(<DataTable columns={columns} rows={children} rowKey={c => c.id} />);
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows[0]).not.toHaveAttribute('tabIndex');
  });
});

describe('DataTable - paginare ferestruită', () => {
  const manyRows: Child[] = Array.from({ length: 31 }, (_, i) => ({
    id: `c${i + 1}`,
    name: `Copil ${i + 1}`,
    fee: 100 * (i + 1),
  }));

  it('nu afișează ellipsis când sunt puține pagini', () => {
    render(<DataTable columns={columns} rows={manyRows.slice(0, 7)} rowKey={c => c.id} pageSize={1} />);
    expect(screen.queryByText('…')).not.toBeInTheDocument();
    for (let page = 1; page <= 7; page += 1) {
      expect(screen.getByRole('button', { name: String(page) })).toBeInTheDocument();
    }
  });

  it('afișează primă/ultimă pagină, vecinii curentei și ellipsis pentru goluri', () => {
    render(<DataTable columns={columns} rows={manyRows} rowKey={c => c.id} pageSize={1} />);
    expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '2' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '31' })).toBeInTheDocument();
    expect(screen.getAllByText('…').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: '15' })).not.toBeInTheDocument();
  });

  it('nu randează butoane pentru paginile sărite și actualizează fereastra la schimbarea paginii', async () => {
    render(<DataTable columns={columns} rows={manyRows} rowKey={c => c.id} pageSize={1} />);
    await userEvent.click(screen.getByRole('button', { name: '31' }));
    expect(screen.getByText('Copil 31')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '30' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '31' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '15' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '2' })).not.toBeInTheDocument();
  });

  it('click pe un buton din fereastra de paginare schimbă pagina afișată', async () => {
    render(<DataTable columns={columns} rows={manyRows} rowKey={c => c.id} pageSize={1} />);
    await userEvent.click(screen.getByRole('button', { name: '2' }));
    expect(screen.getByText('Copil 2')).toBeInTheDocument();
    expect(screen.queryByText('Copil 1')).not.toBeInTheDocument();
  });
});

describe('DataTable groupBy', () => {
  const staff: Staff[] = [
    { id: 's1', name: 'Ana', departmentId: 'DEP-B' },
    { id: 's2', name: 'Bogdan', departmentId: 'DEP-A' },
    { id: 's3', name: 'Cristina', departmentId: 'DEP-B' },
  ];
  const staffColumns: DataTableColumn<Staff>[] = [{ key: 'name', header: 'Nume', render: s => s.name }];

  it('randează un titlu de grup cu numărul de rânduri, respectând ordinea dată', () => {
    render(
      <DataTable
        columns={staffColumns}
        rows={staff}
        rowKey={s => s.id}
        groupBy={{
          key: s => s.departmentId,
          order: ['DEP-A', 'DEP-B'],
          label: key => `${key} (${staff.filter(s => s.departmentId === key).length})`,
        }}
      />,
    );
    const rows = screen.getAllByRole('row').slice(1); // fără antet
    expect(within(rows[0]).getByText('DEP-A (1)')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Bogdan')).toBeInTheDocument();
    expect(within(rows[2]).getByText('DEP-B (2)')).toBeInTheDocument();
    expect(within(rows[3]).getByText('Ana')).toBeInTheDocument();
    expect(within(rows[4]).getByText('Cristina')).toBeInTheDocument();
  });

  it('grupurile care nu apar în `order` merg la coadă, în ordinea de apariție', () => {
    render(
      <DataTable
        columns={staffColumns}
        rows={staff}
        rowKey={s => s.id}
        groupBy={{
          key: s => s.departmentId,
          order: ['DEP-B'],
          label: key => key,
        }}
      />,
    );
    const rows = screen.getAllByRole('row').slice(1);
    expect(within(rows[0]).getByText('DEP-B')).toBeInTheDocument();
    expect(within(rows[3]).getByText('DEP-A')).toBeInTheDocument();
  });

  it('nu paginează cât timp groupBy e activ', () => {
    render(
      <DataTable
        columns={staffColumns}
        rows={staff}
        rowKey={s => s.id}
        pageSize={1}
        groupBy={{ key: s => s.departmentId, label: key => key }}
      />,
    );
    expect(screen.getByText('Ana')).toBeInTheDocument();
    expect(screen.getByText('Cristina')).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });
});
