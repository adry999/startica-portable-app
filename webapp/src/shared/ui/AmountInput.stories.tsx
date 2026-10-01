import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { AmountInput } from './AmountInput';

const meta: Meta<typeof AmountInput> = {
  title: 'Formular/AmountInput',
  component: AmountInput,
  parameters: { design: 'COMPONENTE.md §2 id 25d · Achitari.dc.html#15b' },
  args: { value: '1500', onChange: fn(), ariaLabel: 'Sumă', currency: 'lei' },
};
export default meta;

type Story = StoryObj<typeof AmountInput>;

export const Default: Story = {};

export const WithShortcuts: Story = {
  args: {
    value: '3000',
    shortcuts: (
      <>
        <button type="button">1 lună · 1.500</button>
        <button type="button">2 luni · 3.000</button>
      </>
    ),
  },
};

export const Dialog: Story = { args: { value: '9600', size: 'dialog' } };

export const Disabled: Story = { args: { value: '', ariaLabel: 'Câmp dezactivat', disabled: true } };
