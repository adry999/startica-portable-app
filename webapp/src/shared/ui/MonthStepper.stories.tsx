import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { MonthStepper } from './MonthStepper';
import { DEMO_MONTH } from './stories.fixtures';

const meta: Meta<typeof MonthStepper> = {
  title: 'Formular/MonthStepper',
  component: MonthStepper,
  parameters: { design: '01-copii-zile-de-nastere.md §MonthStepper · Copii.dc.html#2c' },
  args: { value: DEMO_MONTH, onPrev: fn(), onNext: fn() },
};
export default meta;

type Story = StoryObj<typeof MonthStepper>;

export const Default: Story = {};

export const White: Story = { args: { tone: 'white' } };
