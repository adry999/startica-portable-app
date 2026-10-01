import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { Select } from './Select';

const meta: Meta<typeof Select> = {
  title: 'Formular/Select',
  component: Select,
  parameters: { design: 'COMPONENTE.md §0/25b · Copii.dc.html#2a' },
  args: {
    value: 'mama',
    onChange: fn(),
    options: [
      { value: 'mama', label: 'Mamă' },
      { value: 'tata', label: 'Tată' },
      { value: 'bunica', label: 'Bunică' },
    ],
    placeholder: '—',
    ariaLabel: 'Relație',
  },
};
export default meta;

type Story = StoryObj<typeof Select>;

export const Default: Story = {};

export const Invalid: Story = {
  args: { value: '', options: [{ value: 'mdl', label: 'MDL' }], ariaLabel: 'Monedă', invalid: true },
};

export const Disabled: Story = {
  args: { value: '', options: [{ value: 'mdl', label: 'MDL' }], ariaLabel: 'Câmp dezactivat', disabled: true },
};

export const Focus: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const select = canvas.getByRole('combobox');
    await userEvent.tab();
    await expect(select).toHaveFocus();
  },
};
