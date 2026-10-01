import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { Button } from './Button';

const meta: Meta<typeof Button> = {
  title: 'Componente/Button',
  component: Button,
  parameters: { design: '00-comun.md §A · Copii.dc.html#2a' },
  args: { children: 'Salvează', variant: 'primary', size: 'md' },
};
export default meta;

type Story = StoryObj<typeof Button>;

export const Default: Story = {};

export const Ghost: Story = { args: { variant: 'ghost', children: 'Anulează' } };
export const White: Story = { args: { variant: 'white', children: 'White' } };
export const Outline: Story = { args: { variant: 'outline', children: 'Outline' } };
export const Link: Story = { args: { variant: 'link', children: 'Vezi lista →' } };
export const Danger: Story = { args: { variant: 'danger', children: 'Șterge 3 copii' } };

export const Disabled: Story = { args: { disabled: true, children: 'Primary dezactivat' } };

export const Loading: Story = { args: { loading: true, children: 'Salvez…' } };

export const Hover: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button');
    await userEvent.hover(button);
    await expect(button).toBeInTheDocument();
  },
};

export const Focus: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button');
    await userEvent.tab();
    await expect(button).toHaveFocus();
  },
};
