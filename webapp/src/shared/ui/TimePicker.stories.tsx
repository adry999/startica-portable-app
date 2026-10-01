import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { TimePicker } from './TimePicker';

const meta: Meta<typeof TimePicker> = {
  title: 'Formular/TimePicker',
  component: TimePicker,
  parameters: { design: 'DS Date si grafice.dc.html §30c' },
  args: {
    ariaLabel: 'Ora',
    value: '10:00',
    onChange: fn(),
    slots: [
      { value: '09:00', capacity: { taken: 2, total: 4 } },
      { value: '09:30', capacity: { taken: 4, total: 4 } },
      { value: '10:00', loading: true },
    ],
  },
};
export default meta;

type Story = StoryObj<typeof TimePicker>;

export const Default: Story = {};

export const FaraSloturi: Story = { args: { slots: undefined } };

export const Loading: Story = {
  args: { slots: [{ value: '09:00', loading: true }] },
};
