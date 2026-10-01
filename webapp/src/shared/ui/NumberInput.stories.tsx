import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { NumberInput } from './NumberInput';

const meta: Meta<typeof NumberInput> = {
  title: 'Formular/NumberInput',
  component: NumberInput,
  parameters: { design: 'COMPONENTE.md §0/25b · Achitari.dc.html#15b' },
  args: { value: '1500', onChange: fn(), ariaLabel: 'Sumă', suffix: 'lei' },
};
export default meta;

type Story = StoryObj<typeof NumberInput>;

export const Default: Story = {};

export const Invalid: Story = { args: { value: '', ariaLabel: 'Sumă', suffix: undefined, invalid: true } };

export const Disabled: Story = { args: { value: '', ariaLabel: 'Câmp dezactivat', suffix: undefined, disabled: true } };

export const Focus: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole('spinbutton');
    await userEvent.tab();
    await expect(input).toHaveFocus();
  },
};
