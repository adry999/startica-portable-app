import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { SegmentedControl } from './SegmentedControl';

const meta: Meta<typeof SegmentedControl> = {
  title: 'Formular/SegmentedControl',
  component: SegmentedControl,
  parameters: { design: '00-comun.md §D · Achitari.dc.html#5a' },
  args: {
    options: [
      { value: 'tabel', label: 'Tabel' },
      { value: 'luni', label: 'Pe luni' },
    ],
    value: 'tabel',
    onChange: fn(),
    ariaLabel: 'Comutator vizualizare',
  },
};
export default meta;

type Story = StoryObj<typeof SegmentedControl>;

export const Default: Story = {};

export const Hover: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const option = canvas.getByRole('radio', { name: 'Pe luni' });
    await userEvent.hover(option);
    await expect(option).toBeInTheDocument();
  },
};

export const Focus: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.tab();
    const active = canvas.getByRole('radio', { name: 'Tabel' });
    await expect(active).toHaveFocus();
  },
};
