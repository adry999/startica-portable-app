import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { ColumnMenu } from './ColumnMenu';

const meta: Meta<typeof ColumnMenu> = {
  title: 'Tabel și filtre/ColumnMenu',
  component: ColumnMenu,
  parameters: { design: 'Chrome de tabel — alegerea coloanelor vizibile' },
  args: {
    ariaLabel: 'Coloane',
    columns: [
      { key: 'name', label: 'Nume', locked: true },
      { key: 'phone', label: 'Telefon' },
      { key: 'group', label: 'Grupă' },
    ],
    visibleKeys: ['name', 'phone'],
    onChange: fn(),
  },
};
export default meta;

type Story = StoryObj<typeof ColumnMenu>;

export const Default: Story = {};
