import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { IconButton, StatusIconButton } from './IconButton';
import { AttendanceDot } from '@shared/attendance';

const meta: Meta<typeof IconButton> = {
  title: 'Componente/IconButton',
  component: IconButton,
  parameters: { design: 'DS Componente.dc.html §28a' },
  args: { icon: 'close', ariaLabel: 'Închide', size: 'lg', onClick: fn() },
};
export default meta;

type Story = StoryObj<typeof IconButton>;

export const Default: Story = {};

export const Small: Story = { args: { icon: 'more-horizontal', ariaLabel: 'Mai multe acțiuni', size: 'sm' } };

export const Disabled: Story = { args: { disabled: true } };

export const Status: StoryObj<typeof StatusIconButton> = {
  render: () => (
    <StatusIconButton ariaLabel="12 septembrie: prezent" onClick={fn()}>
      <AttendanceDot kind="present" />
    </StatusIconButton>
  ),
};
