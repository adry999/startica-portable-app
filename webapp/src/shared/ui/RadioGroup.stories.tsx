import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { RadioGroup } from './RadioGroup';

const meta: Meta<typeof RadioGroup> = {
  title: 'Formular/RadioGroup',
  component: RadioGroup,
  parameters: { design: 'DS Componente formular.dc.html' },
  args: {
    name: 'demo-radio',
    ariaLabel: 'Metodă',
    value: 'cash',
    onChange: fn(),
    options: [
      { value: 'cash', label: 'Cash' },
      { value: 'card', label: 'Card' },
      { value: 'transfer', label: 'Transfer', disabled: true },
    ],
  },
};
export default meta;

type Story = StoryObj<typeof RadioGroup>;

export const Default: Story = {};

export const Disabled: Story = { args: { disabled: true } };
