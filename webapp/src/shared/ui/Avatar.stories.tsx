import type { Meta, StoryObj } from '@storybook/react-vite';
import { Avatar } from './Avatar';

const meta: Meta<typeof Avatar> = {
  title: 'Componente/Avatar',
  component: Avatar,
  parameters: { design: 'DS Date si grafice.dc.html §28e — 26/32/38/64/84' },
  args: { name: 'Coceva Alisa', size: 32 },
};
export default meta;

type Story = StoryObj<typeof Avatar>;

export const Default: Story = {};

export const Small: Story = { args: { size: 26 } };

export const Large: Story = { args: { size: 84 } };

export const Sizes: Story = {
  render: () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <Avatar name="Coceva Alisa" size={26} />
      <Avatar name="Coceva Alisa" size={32} />
      <Avatar name="Coceva Alisa" size={38} />
      <Avatar name="Coceva Alisa" size={64} />
      <Avatar name="Coceva Alisa" size={84} />
    </div>
  ),
};
