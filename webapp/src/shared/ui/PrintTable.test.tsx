import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PrintTable } from './PrintTable';

interface Row {
  id: string;
  name: string;
  amount: number;
}

const ROWS: Row[] = [
  { id: '1', name: 'Ana', amount: 100 },
  { id: '2', name: 'Ion', amount: 200 },
];

describe('PrintTable', () => {
  it('randează antetul și rândurile', () => {
    render(
      <PrintTable
        columns={[
          { key: 'name', header: 'Nume', render: row => row.name },
          { key: 'amount', header: 'Sumă', render: row => String(row.amount), align: 'end' },
        ]}
        rows={ROWS}
        rowKey={row => row.id}
      />,
    );
    expect(screen.getByText('Nume')).toBeInTheDocument();
    expect(screen.getByText('Ana')).toBeInTheDocument();
    expect(screen.getByText('Ion')).toBeInTheDocument();
  });

  it('randează subsolul dat de apelant', () => {
    render(
      <PrintTable
        columns={[{ key: 'name', header: 'Nume', render: row => row.name }]}
        rows={ROWS}
        rowKey={row => row.id}
        footer={
          <tr>
            <td>Total · 2</td>
          </tr>
        }
      />,
    );
    expect(screen.getByText('Total · 2')).toBeInTheDocument();
  });
});
