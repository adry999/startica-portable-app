import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { StatusIconButton } from './IconButton';
import { AttendanceDot } from '@shared/attendance';

const meta: Meta<typeof StatusIconButton> = {
  title: 'Componente/StatusIconButton',
  component: StatusIconButton,
  parameters: { design: 'Prezenta.dc.html#18b' },
  args: { ariaLabel: '12 septembrie: prezent', onClick: fn(), children: <AttendanceDot kind="present" /> },
};
export default meta;

type Story = StoryObj<typeof StatusIconButton>;

export const Default: Story = {};

export const WithoutContent: Story = {
  args: { ariaLabel: 'Concediu 1-15 iulie', children: undefined, style: { width: 80 } },
};
