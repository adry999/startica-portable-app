import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { TimeInput } from './TimeInput';

const meta: Meta<typeof TimeInput> = {
  title: 'Formular/TimeInput',
  component: TimeInput,
  parameters: { design: 'COMPONENTE.md §0e/30c' },
  args: { value: '09:00', onChange: fn(), ariaLabel: 'Ora' },
};
export default meta;

type Story = StoryObj<typeof TimeInput>;

export const Default: Story = {};

export const Invalid: Story = { args: { value: '', invalid: true } };

export const Disabled: Story = { args: { value: '', ariaLabel: 'Câmp dezactivat', disabled: true } };
