import type { Meta, StoryObj } from '@storybook/react-vite';
import { ProgressBar } from './ProgressBar';

const meta: Meta<typeof ProgressBar> = {
  title: 'Componente/ProgressBar',
  component: ProgressBar,
  parameters: { design: 'DS Date si grafice.dc.html §28e — simplu/segmentat/capacitate' },
  args: { variant: 'simple', value: 62, tone: 'orange', label: 'Completare taxe' },
};
export default meta;

type Story = StoryObj<typeof ProgressBar>;

export const Default: Story = {};

export const Segmented: Story = {
  args: {
    variant: 'segmented',
    segments: [
      { value: 45, tone: 'mint' },
      { value: 30, tone: 'orange' },
      { value: 15, tone: 'yellow' },
    ],
  },
};

export const Capacity: Story = {
  args: { variant: 'capacity', filled: 8, total: 10, label: 'Locuri ocupate' },
};
