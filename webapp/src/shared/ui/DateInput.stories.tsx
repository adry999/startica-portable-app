import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { DateInput } from './DateInput';

const meta: Meta<typeof DateInput> = {
  title: 'Formular/DateInput',
  component: DateInput,
  parameters: { design: 'COMPONENTE.md §0/25b · Achitari.dc.html#15b' },
  args: { value: '2026-09-30', onChange: fn(), ariaLabel: 'Data' },
};
export default meta;

type Story = StoryObj<typeof DateInput>;

export const Default: Story = {};

export const WithTrailing: Story = { args: { value: '2020-01-01', ariaLabel: 'Data nașterii', trailing: '4 ani' } };

export const Invalid: Story = { args: { value: '', ariaLabel: 'Data', invalid: true } };

export const Disabled: Story = { args: { value: '', ariaLabel: 'Câmp dezactivat', disabled: true } };

export const Focus: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByLabelText('Data');
    await userEvent.tab();
    await expect(input).toHaveFocus();
  },
};
