import type { Meta, StoryObj } from '@storybook/react-vite';
import { Icon } from './Icon';

const meta: Meta<typeof Icon> = {
  title: 'Componente/Icon',
  component: Icon,
  parameters: {
    design:
      'DS Fundamente 2.dc.html#33a — set Lucide, linie 2, 14/16/20/24 · singurul fișier care importă lucide-react',
  },
  args: { name: 'search' },
};
export default meta;

type Story = StoryObj<typeof Icon>;

export const Default: Story = {};

export const Set: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 12 }}>
      <Icon name="search" />
      <Icon name="more-horizontal" />
      <Icon name="chevron-down" />
      <Icon name="chevron-up" />
      <Icon name="chevron-left" />
      <Icon name="chevron-right" />
      <Icon name="close" />
      <Icon name="check" />
      <Icon name="menu" />
      <Icon name="grip-vertical" />
      <Icon name="undo" />
      <Icon name="external-link" />
      <Icon name="sort-toggle" />
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <Icon name="check" size={14} />
      <Icon name="check" size={16} />
      <Icon name="check" size={20} />
      <Icon name="check" size={24} />
    </div>
  ),
};

export const AccessibleStandalone: Story = {
  args: { name: 'close', ariaLabel: 'Închide' },
};
