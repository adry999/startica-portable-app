import type { Meta, StoryObj } from '@storybook/react-vite';
import { Spinner } from './Spinner';

const meta: Meta<typeof Spinner> = {
  title: 'Fundamente/Spinner',
  component: Spinner,
  parameters: { design: 'DS Incarcare si stari.dc.html §29a/29b — 12/14/16/24/40, currentColor' },
  args: { size: 24 },
};
export default meta;

type Story = StoryObj<typeof Spinner>;

export const Default: Story = {};

export const Sizes: Story = {
  render: () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <Spinner size={12} />
      <Spinner size={14} />
      <Spinner size={16} />
      <Spinner size={24} />
      <Spinner size={40} />
    </div>
  ),
};
