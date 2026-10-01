import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { GlobalSearch, type GlobalSearchResult } from './GlobalSearch';

const RESULTS: GlobalSearchResult[] = [
  { key: 'c1', label: 'Ionescu Maria', category: 'Copil', onSelect: fn() },
  { key: 'a1', label: 'Rusu Ana', category: 'Angajat', onSelect: fn() },
];

const meta: Meta<typeof GlobalSearch> = {
  title: 'Aplicație/GlobalSearch',
  component: GlobalSearch,
  parameters: { design: '32a — căutare globală (Ctrl+K)' },
  args: { value: 'Ion', onChange: fn(), results: RESULTS },
};
export default meta;

type Story = StoryObj<typeof GlobalSearch>;

export const Default: Story = {};

export const Loading: Story = { args: { results: [], loading: true } };
