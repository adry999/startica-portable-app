import type { Meta, StoryObj } from '@storybook/react-vite';
import { Kbd } from './Kbd';

const meta: Meta<typeof Kbd> = {
  title: 'Componente/Kbd',
  component: Kbd,
  parameters: { design: 'DS Diverse.dc.html §32e — scurtături' },
  args: { children: 'Ctrl+K' },
};
export default meta;

type Story = StoryObj<typeof Kbd>;

export const Default: Story = {};

export const MultipleKeys: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 8 }}>
      <Kbd>Ctrl+K</Kbd>
      <Kbd>Esc</Kbd>
      <Kbd>Ctrl+Z</Kbd>
    </div>
  ),
};
