import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DataTable, type DataTableColumn } from './DataTable';

interface Child {
  id: string;
  name: string;
  fee: number;
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

  it('nu sortează pe o coloană fără sortValue', async () => {
    render(<DataTable columns={columns} rows={children} rowKey={c => c.id} />);
    expect(screen.queryByRole('button', { name: /^$/ })).not.toBeInTheDocument();
  });

  it('paginează când sunt mai multe rânduri decât pageSize', async () => {
    render(<DataTable columns={columns} rows={children} rowKey={c => c.id} pageSize={2} />);
    expect(screen.getByText(/Afișez 1–2 din 3/)).toBeInTheDocument();
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
