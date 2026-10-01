import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { SearchSelect } from './SearchSelect';
import { DEMO_SEARCH_SELECT_OPTIONS } from './stories.fixtures';

const meta: Meta<typeof SearchSelect> = {
  title: 'Formular/SearchSelect',
  component: SearchSelect,
  parameters: { design: 'Grupe.dc.html#3a' },
  args: {
    options: DEMO_SEARCH_SELECT_OPTIONS,
    value: '',
    onChange: fn(),
    ariaLabel: 'Alege un copil',
    placeholder: 'Alege un copil…',
  },
};
export default meta;

type Story = StoryObj<typeof SearchSelect>;

export const Default: Story = {};

export const Disabled: Story = { args: { ariaLabel: 'Câmp dezactivat', disabled: true } };
