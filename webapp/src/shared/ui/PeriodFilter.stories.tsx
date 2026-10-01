import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { PeriodFilter } from './PeriodFilter';
import { DEMO_MONTH } from './stories.fixtures';

const meta: Meta<typeof PeriodFilter> = {
  title: 'Formular/PeriodFilter',
  component: PeriodFilter,
  parameters: { design: 'DS Tabel si filtre.dc.html §27e' },
  args: { from: DEMO_MONTH, to: DEMO_MONTH, onFromChange: fn(), onToChange: fn() },
};
export default meta;

type Story = StoryObj<typeof PeriodFilter>;

export const Default: Story = {};
