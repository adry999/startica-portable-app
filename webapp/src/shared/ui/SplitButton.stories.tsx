import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { SplitButton } from './SplitButton';

const meta: Meta<typeof SplitButton> = {
  title: 'Componente/SplitButton',
  component: SplitButton,
  parameters: { design: 'DS Componente 2.dc.html §34c — variantă ținută minte' },
  args: {
    selectedValue: 'pdf',
    onSelectedValueChange: fn(),
    options: [
      { value: 'pdf', label: 'Exportă PDF', onClick: fn() },
      { value: 'excel', label: 'Exportă Excel', onClick: fn() },
    ],
  },
};
export default meta;

type Story = StoryObj<typeof SplitButton>;

export const Default: Story = {};

export const Loading: Story = { args: { loading: true } };
