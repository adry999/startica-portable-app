import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { MonthInput } from './MonthInput';

const meta: Meta<typeof MonthInput> = {
  title: 'Formular/MonthInput',
  component: MonthInput,
  parameters: { design: 'DS Componente formular.dc.html §25b' },
  args: { value: '2026-09', onChange: fn(), ariaLabel: 'Luna' },
};
export default meta;

type Story = StoryObj<typeof MonthInput>;

export const Default: Story = {};

export const Invalid: Story = { args: { value: '', invalid: true } };

export const Disabled: Story = { args: { value: '', ariaLabel: 'Câmp dezactivat', disabled: true } };
