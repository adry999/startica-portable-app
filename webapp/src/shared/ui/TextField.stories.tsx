import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { TextField } from './TextField';

const meta: Meta<typeof TextField> = {
  title: 'Formular/TextField',
  component: TextField,
  parameters: { design: '14-sms.md · Sms.dc.html#11c' },
  args: { value: '', onChange: fn(), placeholder: 'Nume', ariaLabel: 'Nume' },
};
export default meta;

type Story = StoryObj<typeof TextField>;

export const Default: Story = {};

export const Invalid: Story = { args: { value: '123', ariaLabel: 'Telefon', invalid: true } };

export const Disabled: Story = { args: { value: '', ariaLabel: 'Câmp dezactivat', disabled: true } };

export const Focus: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole('textbox');
    await userEvent.tab();
    await expect(input).toHaveFocus();
  },
};
