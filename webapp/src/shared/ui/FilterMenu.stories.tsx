import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { FilterMenu } from './FilterMenu';

const meta: Meta<typeof FilterMenu> = {
  title: 'Tabel și filtre/FilterMenu',
  component: FilterMenu,
  parameters: { design: 'DS Tabel si filtre.dc.html §27e' },
  args: {
    label: 'Metodă',
    options: [
      { value: 'cash', label: 'Cash', count: 12 },
      { value: 'card', label: 'Card', count: 4 },
    ],
    selected: ['cash'],
    onChange: fn(),
  },
};
export default meta;

type Story = StoryObj<typeof FilterMenu>;

export const Default: Story = {};

export const CountsLoading: Story = {
  args: { label: 'Grupă', options: [{ value: 'a', label: 'Grupa mare' }], selected: [], countsLoading: true },
};
