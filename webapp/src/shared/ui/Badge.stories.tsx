import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge } from './Badge';

const meta: Meta<typeof Badge> = {
  title: 'Componente/Badge',
  component: Badge,
  parameters: { design: '02-copii-lista.md (Grupă/Plată) · 04-vizite.md (Statut) · vizual în Copii.dc.html#2a' },
  args: { tone: 'neutral', children: 'Neutral' },
};
export default meta;

type Story = StoryObj<typeof Badge>;

export const Default: Story = {};

export const Orange: Story = { args: { tone: 'orange', children: 'Orange' } };
export const Mint: Story = { args: { tone: 'mint', children: 'Achitat' } };
export const Yellow: Story = { args: { tone: 'yellow', children: 'Parțial' } };
export const Pink: Story = { args: { tone: 'pink', children: 'Neachitat' } };
export const Teal: Story = { args: { tone: 'teal', children: 'Teal' } };
export const Blue: Story = { args: { tone: 'blue', children: 'Blue' } };
export const Purple: Story = { args: { tone: 'purple', children: 'Purple' } };
export const Coral: Story = { args: { tone: 'coral', children: 'Coral' } };
