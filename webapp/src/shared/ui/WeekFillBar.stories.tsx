import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { WeekFillBar } from './WeekFillBar';

const meta: Meta<typeof WeekFillBar> = {
  title: 'Componente/WeekFillBar',
  component: WeekFillBar,
  parameters: { design: 'COMPONENTE.md — 41b, antetul pontajului' },
  args: {
    weekLabel: '7 – 11 sep',
    onFillPresent: fn(),
    onCopyPreviousWeek: fn(),
  },
};
export default meta;

type Story = StoryObj<typeof WeekFillBar>;

export const Default: Story = {};

export const FillingPresent: Story = {
  args: { fillingPresent: true },
};

export const FillingCopyPreviousWeek: Story = {
  args: { fillingCopyPreviousWeek: true },
};
