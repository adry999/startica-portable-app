import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { SelectableTile } from './SelectableTile';

const meta: Meta<typeof SelectableTile> = {
  title: 'Formular/SelectableTile',
  component: SelectableTile,
  parameters: { design: 'COMPONENTE.md §0i' },
  args: { 'aria-label': 'Maria Ionescu: prezentă', onClick: fn(), children: 'Maria Ionescu' },
};
export default meta;

type Story = StoryObj<typeof SelectableTile>;

export const Default: Story = {};

export const Selected: Story = {
  args: { 'aria-label': 'Grupa Mars: selectată', selected: true, children: 'Grupa Mars (selectată)' },
};

export const Hover: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const tile = canvas.getByRole('button');
    await userEvent.hover(tile);
    await expect(tile).toBeInTheDocument();
  },
};

export const Focus: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const tile = canvas.getByRole('button');
    await userEvent.tab();
    await expect(tile).toHaveFocus();
  },
};
