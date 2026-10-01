import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { ActiveFilters } from './ActiveFilters';

const meta: Meta<typeof ActiveFilters> = {
  title: 'Tabel și filtre/ActiveFilters',
  component: ActiveFilters,
  parameters: { design: 'DS Tabel si filtre.dc.html §27a' },
  args: {
    filters: [
      { key: 'method', label: 'Metodă: Cash', onClear: fn() },
      { key: 'group', label: 'Grupa: Curcubeu', onClear: fn() },
    ],
    onReset: fn(),
  },
};
export default meta;

type Story = StoryObj<typeof ActiveFilters>;

export const Default: Story = {};
