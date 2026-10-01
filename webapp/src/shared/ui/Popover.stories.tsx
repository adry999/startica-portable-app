import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { Popover } from './Popover';

const meta: Meta<typeof Popover> = {
  title: 'Componente/Popover',
  component: Popover,
  parameters: {
    design:
      'COMPONENTE.md §0c/28g · bază pentru FilterMenu, PeriodFilter, SearchSelect, motivul absenței (attendance/ExcuseReasonPopover)',
  },
  args: {
    onClose: fn(),
    ariaLabel: 'Exemplu Popover',
    children: <p>Conținut plutitor, poziționat sub declanșator.</p>,
  },
  decorators: [
    Story => (
      <div style={{ position: 'relative', height: 80 }}>
        <Story />
      </div>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof Popover>;

export const Default: Story = {};
