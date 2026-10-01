import type { Meta, StoryObj } from '@storybook/react-vite';
import { Heatmap } from './Heatmap';

const meta: Meta<typeof Heatmap> = {
  title: 'Componente/Heatmap',
  component: Heatmap,
  parameters: { design: 'DS Date si grafice.dc.html §30e — situația plăților' },
  args: {
    ariaLabel: 'Situația plăților',
    columns: 6,
    cells: [
      { key: '1', label: 'Ian — achitat', state: 'paid' },
      { key: '2', label: 'Feb — parțial', state: 'partial' },
      { key: '3', label: 'Mar — restanță', state: 'overdue' },
      { key: '4', label: 'Apr — curent', state: 'paid', current: true },
      { key: '5', label: 'Mai — viitor', state: 'future' },
      { key: '6', label: 'Iun — fără contract', state: 'no-contract' },
    ],
  },
};
export default meta;

type Story = StoryObj<typeof Heatmap>;

export const Default: Story = {};
