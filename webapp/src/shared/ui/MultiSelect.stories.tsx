import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { MultiSelect } from './MultiSelect';

const meta: Meta<typeof MultiSelect> = {
  title: 'Formular/MultiSelect',
  component: MultiSelect,
  parameters: { design: 'DS Componente 2.dc.html §34j' },
  args: {
    ariaLabel: 'Grupe',
    placeholder: 'Alege grupe…',
    selected: ['a'],
    onChange: fn(),
    options: [
      { value: 'a', label: 'Grupa Mari' },
      { value: 'b', label: 'Grupa Mici' },
      { value: 'c', label: 'Grupa Mijlocii' },
    ],
  },
};
export default meta;

type Story = StoryObj<typeof MultiSelect>;

export const Default: Story = {};

export const Empty: Story = { args: { selected: [] } };
