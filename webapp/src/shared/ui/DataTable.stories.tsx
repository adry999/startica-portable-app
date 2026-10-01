import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { Badge } from './Badge';
import { DataTable, type DataTableColumn } from './DataTable';
import { DEMO_PAYMENT_ROWS, type DemoPaymentRow } from './stories.fixtures';

const STATUS_TONE: Record<DemoPaymentRow['status'], 'mint' | 'yellow' | 'pink'> = {
  achitat: 'mint',
  partial: 'yellow',
  neachitat: 'pink',
};

const PAYMENT_COLUMNS: DataTableColumn<DemoPaymentRow>[] = [
  { key: 'child', header: 'Copil', render: row => row.child, sortValue: row => row.child },
  { key: 'group', header: 'Grupă', render: row => row.group, sortValue: row => row.group },
  {
    key: 'amount',
    header: 'Sumă',
    render: row => `${row.amount} lei`,
    sortValue: row => row.amount,
    align: 'end',
  },
  {
    key: 'status',
    header: 'Statut',
    render: row => <Badge tone={STATUS_TONE[row.status]}>{row.status}</Badge>,
  },
];

const meta: Meta<typeof DataTable<DemoPaymentRow>> = {
  title: 'Tabel și filtre/DataTable',
  component: DataTable,
  parameters: { design: '05-achitari.md (tabel sortabil) · vizual în Achitari.dc.html#5a' },
  args: {
    columns: PAYMENT_COLUMNS,
    rows: DEMO_PAYMENT_ROWS,
    rowKey: row => row.id,
  },
};
export default meta;

type Story = StoryObj<typeof DataTable<DemoPaymentRow>>;

export const Default: Story = {};

export const Selectabil: Story = {
  args: { selectable: true, selectedRowKeys: new Set(['p1']), onSelectedRowKeysChange: fn() },
};

export const GrupatPeGrupa: Story = {
  args: {
    groupBy: {
      key: row => row.group,
      label: key => <strong>{key}</strong>,
    },
  },
};

export const Gol: Story = {
  args: { rows: [], emptyState: <span>Niciun rezultat pentru filtrele alese.</span> },
};

const MANY_ROWS: DemoPaymentRow[] = Array.from({ length: 312 }, (_, index) => ({
  id: `p-many-${index + 1}`,
  child: `Copil ${index + 1}`,
  group: DEMO_PAYMENT_ROWS[index % DEMO_PAYMENT_ROWS.length].group,
  amount: 100 * ((index % 20) + 1),
  method: DEMO_PAYMENT_ROWS[index % DEMO_PAYMENT_ROWS.length].method,
  status: DEMO_PAYMENT_ROWS[index % DEMO_PAYMENT_ROWS.length].status,
}));

/** F1 (FEEDBACK-01-10.md) — 312 rânduri, paginare ferestruită cu elipsă (38a). */
export const Paginat: Story = {
  args: { rows: MANY_ROWS },
};
