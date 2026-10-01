import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { MonthPicker } from './MonthPicker';
import { DEMO_MONTH } from './stories.fixtures';

const meta: Meta<typeof MonthPicker> = {
  title: 'Formular/MonthPicker',
  component: MonthPicker,
  parameters: { design: '08-dashboard.md · Dashboard.dc.html#1a' },
  args: { value: DEMO_MONTH, onChange: fn() },
};
export default meta;

type Story = StoryObj<typeof MonthPicker>;

export const Default: Story = {};
