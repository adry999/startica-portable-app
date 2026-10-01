import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { Card } from './Card';

const meta: Meta<typeof Card> = {
  title: 'Componente/Card',
  component: Card,
  parameters: { design: '08-dashboard.md (carduri KPI) · vizual în Dashboard.dc.html#1a' },
  args: { tone: 'white', children: 'Alb' },
};
export default meta;

type Story = StoryObj<typeof Card>;

export const Default: Story = {};

export const Orange: Story = { args: { tone: 'orange', children: 'Orange' } };
export const Mint: Story = { args: { tone: 'mint', children: 'Mint' } };
export const Yellow: Story = { args: { tone: 'yellow', children: 'Yellow' } };
export const Pink: Story = { args: { tone: 'pink', children: 'Pink' } };
export const Dashed: Story = { args: { tone: 'dashed', children: 'Punctat' } };

export const Decorative: Story = { args: { tone: 'orange', decorative: true, children: 'Cerc decorativ' } };
export const DecorativeLarge: Story = {
  args: { tone: 'mint', decorative: 'lg', children: 'Cerc mare (Încasări)' },
};

export const Clickable: Story = { args: { tone: 'white', onClick: fn(), children: 'Card apăsabil' } };

export const Hover: Story = {
  args: { onClick: fn() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const card = canvas.getByRole('button');
    await userEvent.hover(card);
    await expect(card).toBeInTheDocument();
  },
};

export const Focus: Story = {
  args: { onClick: fn() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const card = canvas.getByRole('button');
    await userEvent.tab();
    await expect(card).toHaveFocus();
  },
};
