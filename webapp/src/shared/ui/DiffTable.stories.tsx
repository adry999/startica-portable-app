import type { Meta, StoryObj } from '@storybook/react-vite';
import { DiffTable } from './DiffTable';

const meta: Meta<typeof DiffTable> = {
  title: 'Tabel și filtre/DiffTable',
  component: DiffTable,
  parameters: { design: 'DS Componente 2.dc.html §34e — Conflicte, comparație locală/de la distanță' },
  args: {
    columns: [
      { key: 'local', label: 'Pe acest calculator' },
      { key: 'remote', label: 'Pe LAPTOP-ANA' },
    ],
    rows: [
      { key: 'name', label: 'Nume', local: 'Ionescu Maria', remote: 'Ionescu Maria', differs: false },
      { key: 'phone', label: 'Telefon', local: '069123456', remote: '069999999', differs: true },
    ],
    note: 'Rândurile galbene diferă. Celelalte câmpuri sunt identice.',
  },
};
export default meta;

type Story = StoryObj<typeof DiffTable>;

export const Default: Story = {};

export const FaraNote: Story = { args: { note: undefined } };
