import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { NumberStepper } from './NumberStepper';

const meta: Meta<typeof NumberStepper> = {
  title: 'Componente/NumberStepper',
  component: NumberStepper,
  parameters: { design: 'DS Diverse.dc.html §32g — locuri pe oră' },
  args: { value: 4, min: 0, max: 10, onChange: fn(), ariaLabel: 'Locuri' },
};
export default meta;

type Story = StoryObj<typeof NumberStepper>;

export const Default: Story = {};

export const Disabled: Story = { args: { disabled: true, ariaLabel: 'Locuri dezactivate' } };
