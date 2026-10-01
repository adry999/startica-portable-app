import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { Checkbox } from './Checkbox';

const meta: Meta<typeof Checkbox> = {
  title: 'Formular/Checkbox',
  component: Checkbox,
  parameters: { design: 'COMPONENTE.md §25c · Achitari.dc.html#15b' },
  args: { checked: true, onChange: fn(), ariaLabel: 'Trimite confirmare prin SMS' },
};
export default meta;

type Story = StoryObj<typeof Checkbox>;

export const Default: Story = {};

export const Off: Story = { args: { checked: false } };

export const Disabled: Story = { args: { checked: false, ariaLabel: 'Bifă dezactivată', disabled: true } };

export const Hover: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const checkbox = canvas.getByRole('checkbox');
    await userEvent.hover(checkbox);
    await expect(checkbox).toBeInTheDocument();
  },
};

export const Focus: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const checkbox = canvas.getByRole('checkbox');
    await userEvent.tab();
    await expect(checkbox).toHaveFocus();
  },
};
