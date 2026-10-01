import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { DayStepper } from './DayStepper';
import { DEMO_DAY, DEMO_MAX_DAY } from './stories.fixtures';

const meta: Meta<typeof DayStepper> = {
  title: 'Formular/DayStepper',
  component: DayStepper,
  parameters: { design: '19-prezenta.md · Prezenta.dc.html#18a' },
  args: { value: DEMO_DAY, onChange: fn(), max: DEMO_MAX_DAY },
};
export default meta;

type Story = StoryObj<typeof DayStepper>;

export const Default: Story = {};
