import type { Meta, StoryObj } from '@storybook/react-vite';
import { PrintTable } from './PrintTable';

interface DemoRow {
  name: string;
  amount: number;
}

const DEMO_ROWS: DemoRow[] = [
  { name: 'Ana Popescu', amount: 0 },
  { name: 'Ion Rusu', amount: 350 },
];

const meta: Meta<typeof PrintTable<DemoRow>> = {
  title: 'Tipare de pagină/PrintTable',
  component: PrintTable,
  parameters: {
    design: 'DS Componente.dc.html#32f — tabel A4, cap repetat pe fiecare pagină (Situația plăților, StatusPrint.tsx)',
  },
  args: {
    columns: [
      { key: 'name', header: 'Copil', render: (row: DemoRow) => row.name },
      { key: 'amount', header: 'Rest', align: 'end', render: (row: DemoRow) => `${row.amount} lei` },
    ],
    rows: DEMO_ROWS,
    rowKey: row => row.name,
    footer: (
      <tr>
        <td>Total · 2 copii</td>
        <td style={{ textAlign: 'right' }}>350 lei</td>
      </tr>
    ),
  },
};
export default meta;

type Story = StoryObj<typeof PrintTable<DemoRow>>;

export const Default: Story = {};

export const WithoutHeader: Story = { args: { showHeader: false, footer: undefined } };
