import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { Toggle } from './Toggle';

const meta: Meta<typeof Toggle> = {
  title: 'Formular/Toggle',
  component: Toggle,
  parameters: { design: '12-administrare.md §10b · Administrare.dc.html#10b' },
  args: { checked: true, onChange: fn(), ariaLabel: 'Restanțe' },
};
export default meta;

type Story = StoryObj<typeof Toggle>;

export const Default: Story = {};

export const Off: Story = { args: { checked: false, ariaLabel: 'Probleme la backup' } };

export const Disabled: Story = { args: { checked: true, ariaLabel: 'Comutator dezactivat', disabled: true } };

export const Hover: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggle = canvas.getByRole('switch');
    await userEvent.hover(toggle);
    await expect(toggle).toBeInTheDocument();
  },
};

export const Focus: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggle = canvas.getByRole('switch');
    await userEvent.tab();
    await expect(toggle).toHaveFocus();
  },
};
