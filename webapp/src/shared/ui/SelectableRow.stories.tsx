import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { SelectableRow } from './SelectableRow';

const meta: Meta<typeof SelectableRow> = {
  title: 'Formular/SelectableRow',
  component: SelectableRow,
  parameters: { design: 'COMPONENTE.md §0i' },
  args: { 'aria-label': 'Rând listă', onClick: fn(), children: 'Rândul din listă — hit-area pe tot rândul' },
};
export default meta;

type Story = StoryObj<typeof SelectableRow>;

export const Default: Story = {};

export const Selected: Story = { args: { selected: true } };

export const Hover: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const row = canvas.getByRole('button');
    await userEvent.hover(row);
    await expect(row).toBeInTheDocument();
  },
};

export const Focus: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const row = canvas.getByRole('button');
    await userEvent.tab();
    await expect(row).toHaveFocus();
  },
};
