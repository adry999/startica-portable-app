import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { SearchInput } from './SearchInput';

const meta: Meta<typeof SearchInput> = {
  title: 'Formular/SearchInput',
  component: SearchInput,
  parameters: { design: '00-comun.md §E · Copii.dc.html#2a' },
  args: { value: '', onChange: fn(), placeholder: 'Caută un copil…', ariaLabel: 'Căutare copii' },
};
export default meta;

type Story = StoryObj<typeof SearchInput>;

export const Default: Story = {};
