import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { TextInput } from './TextInput';

const meta: Meta<typeof TextInput> = {
  title: 'Formular/TextInput',
  component: TextInput,
  parameters: { design: 'COMPONENTE.md §0/25a' },
  args: { value: '', onChange: fn(), placeholder: 'ex. Excursie', ariaLabel: 'Nume' },
};
export default meta;

type Story = StoryObj<typeof TextInput>;

export const Default: Story = {};

export const WithSuffix: Story = { args: { value: '150', ariaLabel: 'Preț', suffix: 'lei' } };

export const Invalid: Story = { args: { value: 'abc', ariaLabel: 'Sumă', invalid: true } };

export const Disabled: Story = { args: { value: '', ariaLabel: 'Câmp dezactivat', disabled: true } };

export const Focus: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole('textbox');
    await userEvent.tab();
    await expect(input).toHaveFocus();
  },
};
