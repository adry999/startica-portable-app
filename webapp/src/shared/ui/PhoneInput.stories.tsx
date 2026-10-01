import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { PhoneInput } from './PhoneInput';

const meta: Meta<typeof PhoneInput> = {
  title: 'Formular/PhoneInput',
  component: PhoneInput,
  parameters: { design: 'COMPONENTE.md §0/25b · Copii.dc.html#2a' },
  args: { value: '', onChange: fn(), placeholder: '069123456', ariaLabel: 'Telefon' },
};
export default meta;

type Story = StoryObj<typeof PhoneInput>;

export const Default: Story = {};

export const Valid: Story = { args: { value: '069123456', ariaLabel: 'Telefon' } };

export const Invalid: Story = { args: { value: '123', ariaLabel: 'Telefon' } };

export const Disabled: Story = { args: { value: '', ariaLabel: 'Câmp dezactivat', disabled: true } };

export const Focus: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole('textbox');
    await userEvent.tab();
    await expect(input).toHaveFocus();
  },
};
