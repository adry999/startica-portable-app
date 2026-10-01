import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { PinInput } from './PinInput';

const meta: Meta<typeof PinInput> = {
  title: 'Formular/PinInput',
  component: PinInput,
  parameters: { design: 'DS Componente 2.dc.html §34f' },
  args: { ariaLabel: 'Cod PIN', value: '12', onChange: fn() },
};
export default meta;

type Story = StoryObj<typeof PinInput>;

export const Default: Story = {};

export const Invalid: Story = { args: { invalid: true } };

export const Disabled: Story = { args: { disabled: true } };
