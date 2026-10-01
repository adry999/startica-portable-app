import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { DatePicker } from './DatePicker';

const meta: Meta<typeof DatePicker> = {
  title: 'Formular/DatePicker',
  component: DatePicker,
  parameters: { design: 'DS Date si grafice.dc.html §30a' },
  args: { ariaLabel: 'Data', value: '2026-09-15', onChange: fn() },
};
export default meta;

type Story = StoryObj<typeof DatePicker>;

export const Default: Story = {};

export const Gol: Story = { args: { value: '' } };

export const CuLimite: Story = { args: { min: '2026-09-01', max: '2026-09-30' } };
