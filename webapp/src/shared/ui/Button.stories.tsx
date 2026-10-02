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

export const Mint: Story = { args: { variant: 'mint', children: 'Toți prezenți L–V' } };
export const Ghost: Story = { args: { variant: 'ghost', children: 'Anulează' } };
export const White: Story = { args: { variant: 'white', children: 'White' } };
export const Outline: Story = { args: { variant: 'outline', children: 'Outline' } };
export const Link: Story = { args: { variant: 'link', children: 'Vezi lista →' } };

// F22 (PROMPT-11 §10): link pur, fără fundal/bordură — pe alb (implicit, de mai sus), pe cremă, și
// pe un card colorat cu tone="inherit" (culoarea vine din card, nu din --orange-ink fix).
export const LinkPeCrema: Story = {
  args: { variant: 'link', children: 'Vezi calendarul →' },
  decorators: [
    Story => (
      <div style={{ background: 'var(--cream)', padding: 16 }}>
        <Story />
      </div>
    ),
  ],
};

export const LinkPeCardColorat: Story = {
  args: { variant: 'link', tone: 'inherit', children: 'Vezi calendarul →' },
  decorators: [
    Story => (
      <div style={{ background: 'var(--orange-soft)', color: 'var(--orange-ink)', padding: 16, borderRadius: 12 }}>
        <Story />
      </div>
    ),
  ],
};
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
